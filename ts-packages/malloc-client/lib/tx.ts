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
  SpecialAccountConnectedWallet,
  SpecialAccountType,
  SpecialAccountWithKeyPair,
  Transaction,
} from "./interfaces";
import { Account, ConnectedWalletAccount, WalletConnection } from "near-api-js";
import { Wallet } from "web3-eth-accounts";

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
) => {
  const results = await Promise.all(
    txs.map((tx) => {
      tx.publicKey = new PublicKey(account.keypair.getPublicKey())
      const serializedTx = tx.encode()
      const serializedTxHash = new Uint8Array(sha256.array(serializedTx));

      const signature = account.keypair.sign(serializedTxHash);
      const signedTransaction = new nearAPI.transactions.SignedTransaction({
        transaction: tx,
        signature: new nearAPI.transactions.Signature({
          keyType: tx.publicKey.keyType,
          data: signature.signature,
        }),
      });
      console.log(signedTransaction)

      // encodes transaction to serialized Borsh (required for all transactions)
      const signedSerializedTx = signedTransaction.encode();
      // sends transaction to NEAR blockchain via JSON RPC call and records the result
      return provider.sendJsonRpc("broadcast_tx_commit", [
        Buffer.from(signedSerializedTx).toString("base64"),
      ]);
    })
  );
};

const signAndSendTxsWalletConnect = async (
  txs: nearAPI.transactions.Transaction[],
  walletConnect: WalletConnection,
  callbackUrl?: string
) => {
  return walletConnect.requestSignTransactions({
    transactions: txs,
    callbackUrl,
  });
};

// TODO: have signerAccount be some idiomatic thingy where ConnectedWalletAccount is wrapped in interface
export const executeMultipleTx = async (
  signerAccount: SpecialAccountWithKeyPair | SpecialAccountConnectedWallet,
  transactions: Transaction[]
) => {
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
  await signAndSendTxsMethod(nearTransactions, signerAccount as any);
};
