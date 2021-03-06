import BN from "bn.js";
import { baseDecode, serialize } from "borsh";
import { sha256 } from "js-sha256";
import * as nearAPI from "near-api-js";
import {
  Action as NearAction,
  addKey,
  createTransaction as nearCreateTransaction,
  deleteKey,
  functionCallAccessKey,
  signTransaction,
  Transaction as NearTransaction,
} from "near-api-js/lib/transaction";
import { KeyPair, PublicKey } from "near-api-js/lib/utils";
import { functionCall, SCHEMA } from "near-api-js/lib/transaction";
import {
  TxAction,
  AccountId,
  Transaction,
  SpecialAccount,
  SpecialAccountConnectedWallet,
  SpecialAccountType,
  SpecialAccountWithKeyPair,
  TransactionWithPromiseResult,
  TransactionWithPromiseResultFlag,
  ExecuteMultipleTxOpts,
  TxHashesOrUndefined,
} from "./interfaces";
import {
  Account,
  ConnectedWalletAccount,
  Connection,
  Contract,
  utils,
  WalletConnection,
} from "near-api-js";
import { Wallet } from "web3-eth-accounts";
import {
  ExecutionStatus,
  ExecutionStatusBasic,
} from "near-api-js/lib/providers/provider";
import { MallocErrors } from "./errors";
import { SignAndSendTransactionOptions } from "near-api-js/lib/account";

export const MAX_GAS_STR = "300000000000000";
export const MAX_GAS = new BN(MAX_GAS_STR);

// TODO: handle env w/ testnet
const provider = new nearAPI.providers.JsonRpcProvider(
  `https://rpc.testnet.near.org`
);

export const createTransactionKP = async (
  account: SpecialAccountWithKeyPair,
  receiverId: AccountId,
  actions: NearAction[],
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
  actions: NearAction[],
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

  return nearCreateTransaction(
    account.accountId,
    publicKey,
    receiverId,
    nonce,
    actions,
    blockHash
  );
};

const signAndSendKPSpecified = async (
  txs: nearAPI.transactions.Transaction[],
  account: SpecialAccount,
  kp: KeyPair
) => {
  const lazyTxCalls = txs.map((tx) => {
    tx.publicKey = new PublicKey(kp.getPublicKey());
    const serializedTx = tx.encode();
    const serializedTxHash = new Uint8Array(sha256.array(serializedTx));

    const signature = kp.sign(serializedTxHash);
    const signedTransaction = new nearAPI.transactions.SignedTransaction({
      transaction: tx,
      signature: new nearAPI.transactions.Signature({
        keyType: tx.publicKey.keyType,
        data: signature.signature,
      }),
    });

    // sends transaction to NEAR blockchain via JSON RPC call and records the result
    return async () => {
      const ret = await provider.sendTransaction(signedTransaction);
      return ret.transaction.hash;
    };
  });

  const sleepMS = 20;
  const txHashProms: Promise<string>[] = [];
  for (let i = 0; i < lazyTxCalls.length; i++) {
    await new Promise<void>((res, rej) => {
      setTimeout(() => {
        txHashProms.push(lazyTxCalls[i]());
        res();
      }, sleepMS);
    });
  }

  return await Promise.all(txHashProms);
};

export const signAndSendKP = async (
  txs: nearAPI.transactions.Transaction[],
  account: SpecialAccountWithKeyPair
): Promise<string[]> => {
  return signAndSendKPSpecified(txs, account, account.keypair);
};

const actionToNearAction = (action: TxAction): NearAction => {
  if (action.functionCall) {
    return functionCall(
      action.functionCall.methodName,
      action.functionCall.args || {},
      new BN(action.functionCall.gas || MAX_GAS),
      new BN(action.functionCall.amount || 0)
    );
  } else if (action.functionCallAccessKey) {
    const accessKey = functionCallAccessKey(
      action.functionCallAccessKey.accessKey.receiverId,
      action.functionCallAccessKey.accessKey.methodNames,
      // new BN(action.functionCallAccessKey.accessKey.allowance)
    );
    return addKey(
      PublicKey.from(action.functionCallAccessKey.publicKey),
      accessKey
    );
  } else if (action.deleteKey) {
    return deleteKey(action.deleteKey.publicKey);
  }
  throw MallocErrors.EXPECTED_TX_ACTION_PROPERTY();
};

// TODO: how can we have the tx hashes here... maybe something w/ callback url??
const signAndSendTxsWalletConnect = async (
  txs: NearTransaction[],
  account: SpecialAccountConnectedWallet,
  callbackUrl?: string
): Promise<void> => {
  account.walletConnection.requestSignTransactions({
    transactions: txs,
    callbackUrl,
  });
};

// TODO: is there a better way of doing this?
/**
 * signAndSendTxsWalletConnectNoAttachedDeposit - send transactions without an attached amount
 * This is useful for sending transactions without a popup
 */
// TODO: this is really slow and should be parallelized somehow, maybe either reaching out to near team or having malloc add a key pair
// const signAndSendTxFunctionCallsWalletConnectNoDeposit = async (
//   txs: NearTransaction[],
//   account: SpecialAccountConnectedWallet,
// ): Promise<string[]> => {
//   const signAndSendActionsInTx = async (
//     tx: NearTransaction
//   ): Promise<string[]> => {
//     return await Promise.all(
//       tx.actions.map(async (action) => {
//         if (!action.functionCall) {
//           throw "Only function calls are allowed when signing and sending a tx to malloc";
//         }
//         const ret = await account.functionCall({
//           contractId: tx.receiverId,
//           methodName: action.functionCall.methodName,
//           args: action.functionCall.args,
//           gas: action.functionCall.gas,
//           attachedDeposit: action.functionCall.deposit,
//         });
//         return ret.transaction.hash;
//       })
//     );
//   };
//   let txHashes = [] as string[];
//   for (let i = 0; i < txs.length; i++) {
//     txHashes.push(...(await signAndSendActionsInTx(txs[i])));
//   }
//   return txHashes;
// };

type ExecuteMultiTxNoDepositOpts<
  T extends SpecialAccountConnectedWallet | SpecialAccountWithKeyPair
> = {
  keyPair?: KeyPair;
} & ExecuteMultipleTxOpts<T>;

export const executeMultipleTxNoDeposit = async <
  T extends SpecialAccountConnectedWallet | SpecialAccountWithKeyPair
>(
  signerAccount: T,
  transactions: Transaction[],
  opts?: ExecuteMultiTxNoDepositOpts<T>
): Promise<string[]> => {
  if (
    signerAccount.type === SpecialAccountType.WebConnected &&
    (!opts || !opts?.keyPair)
  )
    throw MallocErrors.EXPECTED_A_MALLOC_ACCESS_KEY(
      "Sending a tx with no deposit"
    );
  const signAndSendTxsMethod =
    signerAccount.type === SpecialAccountType.KeyPair
      ? signAndSendKP
      : (txs: NearTransaction[], account: SpecialAccount) =>
          signAndSendKPSpecified(
            txs,
            account,
            (opts as ExecuteMultiTxNoDepositOpts<T>).keyPair as KeyPair
          );
  return (await _executeMultipleTx<T>(
    signerAccount,
    transactions,
    //@ts-ignore
    signAndSendTxsMethod,
    opts
  )) as string[];
};

export const executeMultipleTx = async <
  T extends SpecialAccountConnectedWallet | SpecialAccountWithKeyPair
>(
  signerAccount: T,
  transactions: Transaction[],
  opts?: ExecuteMultipleTxOpts<T>
): Promise<TxHashesOrUndefined<T>> => {
  const signAndSendTxsMethod =
    signerAccount.type === SpecialAccountType.KeyPair
      ? signAndSendKP
      : signAndSendTxsWalletConnect;
  return (await _executeMultipleTx<T>(
    signerAccount,
    transactions,
    //@ts-ignore
    signAndSendTxsMethod,
    opts
  )) as TxHashesOrUndefined<T>;
};

// TODO: have signerAccount be some idiomatic thingy where ConnectedWalletAccount is wrapped in interface
const _executeMultipleTx = async <
  T extends SpecialAccountConnectedWallet | SpecialAccountWithKeyPair
>(
  signerAccount: T,
  transactions: Transaction[],
  signAndSendTxsMethod: (
    txs: NearTransaction[],
    account: SpecialAccount,
    callbackUrl?: string
  ) => Promise<TxHashesOrUndefined<T> | string[]>,
  opts?: ExecuteMultipleTxOpts<T>
): Promise<TxHashesOrUndefined<T> | string[]> => {
  const createTransaction =
    signerAccount.type === SpecialAccountType.KeyPair
      ? createTransactionKP
      : createTransactionWalletAccount;

  const nearTransactions = await Promise.all(
    transactions.map((t, i) => {
      return createTransaction(
        signerAccount as any,
        t.receiverId,
        t.actions.map(actionToNearAction),
        i + 1
      );
    })
  );
  console.log("Transactions", JSON.stringify(nearTransactions));
  return (await signAndSendTxsMethod(
    nearTransactions,
    signerAccount as any,
    opts?.callbackUrl || ""
  )) as TxHashesOrUndefined<T>;
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
      (result as ExecutionStatus)["SuccessValue"] === "" ||
      (result as ExecutionStatus)["SuccessValue"] ||
      (result as ExecutionStatus)["SuccessReceiptId"] === "" ||
      (result as ExecutionStatus)["SuccessReceiptId"];

    if (isResultSuccess) {
      return {
        flag: TransactionWithPromiseResultFlag.SUCCESS,
      };
    }
    console.log(JSON.stringify(result));
    return {
      // TODO: add some reason or something for this!!
      flag: TransactionWithPromiseResultFlag.FAILURE,
      message:
        JSON.stringify(
          (result as ExecutionStatus)["Failure"]?.error_message ||
            (result as any).Failure?.ActionError
        ) ?? undefined,
    };
  };

  const resultStatuses: (ExecutionStatus | ExecutionStatusBasic)[] = (
    await Promise.all(hashes.map(resolveTxWithPromise))
  ).flat();
  return resultStatuses.map(parseResult);
};

export const resolveTransactionsReducedWithPromises = async (
  hashes: string[],
  accountId: string
): Promise<TransactionWithPromiseResult> => {
  {
    const results = await resolveTransactionsWithPromise(hashes, accountId);
    results.forEach((result) => {
      if (result.flag !== "success")
        throw MallocErrors.TRANSACTION_PROMISE_FAILED(result.message);
    });
    return {
      flag: TransactionWithPromiseResultFlag.SUCCESS,
    };
  }
};
