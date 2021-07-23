import BN from "bn.js";
import { baseDecode } from "borsh";
import { sha256 } from "js-sha256";
import * as nearAPI from "near-api-js";
import {
  Action,
  createTransaction as nearCreateTransaction,
} from "near-api-js/lib/transaction";
import { KeyPair, PublicKey } from "near-api-js/lib/utils";
import { functionCall } from "near-api-js/lib/transaction";
import {
  AccountId,
  SpecialAccount,
  SpecialAccountConnectedWallet,
  SpecialAccountType,
  SpecialAccountWithKeyPair,
  Transaction,
  TransactionWithPromiseResult,
  TransactionWithPromiseResultFlag,
} from "./interfaces";
import {
  Account,
  ConnectedWalletAccount,
  utils,
  WalletConnection,
} from "near-api-js";
import { Wallet } from "web3-eth-accounts";
import {
  ExecutionStatus,
  ExecutionStatusBasic,
} from "near-api-js/lib/providers/provider";

export const MAX_GAS_STR = "300000000000000";
export const MAX_GAS = new BN("300000000000000");

// TODO: handle env w/ testnet
const provider = new nearAPI.providers.JsonRpcProvider(
  `https://rpc.testnet.near.org`
);

export const createTransactionKP = async (
  account: SpecialAccountWithKeyPair,
  receiverId: AccountId,
  actions: Action[],
  nonceOffset = 1
) => {
  const publicKey = account.keypair.getPublicKey();

  const accessKey = await provider.query<any>(
    `access_key/${account.accountId}/${publicKey.toString()}`,
    ""
  );
  const nonce = accessKey.nonce + nonceOffset;
  const recentBlockHash = nearAPI.utils.serialize.base_decode(
    accessKey.block_hash
  );
  return nearAPI.transactions.createTransaction(
    account.accountId,
    account.keypair.getPublicKey(),
    receiverId,
    nonce,
    actions,
    recentBlockHash
  );
};

export const createTransactionWalletAccount = async (
  account: ConnectedWalletAccount,
  receiverId: AccountId,
  actions: Action[],
  nonceOffset = 1
): Promise<nearAPI.transactions.Transaction> => {
  const localKey = await account.connection.signer.getPublicKey(
    account.accountId,
    account.connection.networkId
  );
  let accessKey = await (
    account as ConnectedWalletAccount
  ).accessKeyForTransaction(receiverId, actions, localKey);
  if (!accessKey) {
    throw new Error(
      `Cannot find matching key for transaction sent to ${receiverId}`
    );
  }

  const block = await account.connection.provider.block({
    finality: "final",
  });
  const blockHash = baseDecode(block.header.hash);

  const publicKey = PublicKey.from(accessKey.public_key);
  const nonce = accessKey.access_key.nonce + nonceOffset;

  return nearAPI.transactions.createTransaction(
    account.accountId,
    publicKey,
    receiverId,
    nonce,
    actions,
    blockHash
  );
};

export const signAndSendKP = async (
  txs: nearAPI.transactions.Transaction[],
  account: SpecialAccountWithKeyPair
): Promise<string[]> => {
  return await Promise.all(
    txs.map(async (tx) => {
      tx.publicKey = new PublicKey(account.keypair.getPublicKey());
      const serializedTx = tx.encode();
      const serializedTxHash = new Uint8Array(sha256.array(serializedTx));

      const signature = account.keypair.sign(serializedTxHash);
      const signedTransaction = new nearAPI.transactions.SignedTransaction({
        transaction: tx,
        signature: new nearAPI.transactions.Signature({
          keyType: tx.publicKey.keyType,
          data: signature.signature,
        }),
      });

      // encodes transaction to serialized Borsh (required for all transactions)
      const signedSerializedTx = signedTransaction.encode();
      // sends transaction to NEAR blockchain via JSON RPC call and records the result
      const ret = await provider.sendJsonRpc("broadcast_tx_commit", [
        Buffer.from(signedSerializedTx).toString("base64"),
      ]);
      return (ret as any).transaction.hash as string;
    })
  );
};

// TODO: how can we have the tx hashes here... maybe something w/ callback url??
const signAndSendTxsWalletConnect = async (
  txs: nearAPI.transactions.Transaction[],
  walletConnect: WalletConnection,
  callbackUrl?: string
): Promise<void> => {
  walletConnect.requestSignTransactions({
    transactions: txs,
    callbackUrl,
  });
};

// TODO: have signerAccount be some idiomatic thingy where ConnectedWalletAccount is wrapped in interface
export const executeMultipleTx = async <
  T extends SpecialAccountConnectedWallet | SpecialAccountWithKeyPair
>(
  signerAccount: T,
  transactions: Transaction[],
  callbackUrl?: T extends SpecialAccountConnectedWallet ? string : never
): Promise<T extends SpecialAccountConnectedWallet ? void : string[]> => {
  const createTransaction =
    signerAccount.type === SpecialAccountType.KeyPair
      ? createTransactionKP
      : createTransactionWalletAccount;
  const signAndSendTxsMethod =
    signerAccount.type === SpecialAccountType.KeyPair
      ? signAndSendKP
      : signAndSendTxsWalletConnect;
  const nearTransactions = await Promise.all(
    transactions.map((t, i) => {
      return createTransaction(
        signerAccount as any,
        t.receiverId,
        t.functionCalls.map((fc) =>
          functionCall(
            fc.methodName,
            fc.args || {},
            new BN(fc.gas || MAX_GAS),
            new BN(fc.amount || 0)
          )
        ),
        i + 1
      );
    })
  );
  return (await signAndSendTxsMethod(
    nearTransactions,
    signerAccount as any,
    callbackUrl
  )) as T extends SpecialAccountConnectedWallet ? void : string[];
};

export const resolveTransactionsWithPromise = async (
  hashes: string[],
  accountId: string
): Promise<TransactionWithPromiseResult[]> => {
  const resolveTxWithPromise = async (hash: string) => {
    const res = await provider.txStatusReceipts(
      new Uint8Array(utils.serialize.base_decode(hash)),
      accountId
    );
    return res.receipts_outcome.map((outcome) => outcome.outcome.status);
  };
  const parseResult = (
    result: ExecutionStatus | ExecutionStatusBasic
  ): TransactionWithPromiseResult => {
    const isResultSuccess =
      result["SuccessValue"] === "" ||
      result["SuccessValue"] ||
      result["SuccessReceiptId"] === "" ||
      result["SuccessReceiptId"];

    if (isResultSuccess) {
      return {
        flag: TransactionWithPromiseResultFlag.SUCCESS,
      };
    }
    return {
      // TODO: add some reason or something for this!!
      flag: TransactionWithPromiseResultFlag.FAILURE,
      message: result["Failure"]?.error_message ?? undefined,
    };
  };

  const resultStatuses: (ExecutionStatus | ExecutionStatusBasic)[] = (
    await Promise.all(hashes.map(resolveTxWithPromise))
  ).flat();
  return resultStatuses.map(parseResult);
};
