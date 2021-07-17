import { baseDecode } from "borsh";
import { Account } from "near-api-js";
import {
  Action,
  createTransaction as nearCreateTransaction,
} from "near-api-js/lib/transaction";
import { PublicKey } from "near-api-js/lib/utils";
import { Transaction } from "./interfaces";

const createTransaction = async ({
  signerAccount,
  receiverId,
  actions,
  nonceOffset = 1,
}: {
  signerAccount: Account;
  receiverId: string;
  actions: Action[];
  nonceOffset?: number;
}) => {
  const localKey = await signerAccount.connection.signer.getPublicKey(
    signerAccount.accountId,
    signerAccount.connection.networkId
  );
  // TODO: how to find?
  let accessKey = await signerAccount.accessKeyForTransaction(
    receiverId,
    actions,
    localKey
  );
  if (!accessKey) {
    throw new Error(
      `Cannot find matching key for transaction sent to ${receiverId}`
    );
  }

  const block = await signerAccount.connection.provider.block({
    finality: "final",
  });
  const blockHash = baseDecode(block.header.hash);

  const publicKey = PublicKey.from(accessKey.public_key);
  const nonce = accessKey.access_key.nonce + nonceOffset;

  return nearCreateTransaction(
    signerAccount.accountId,
    publicKey,
    receiverId,
    nonce,
    actions,
    blockHash
  );
};

export const executeMultipleTx = async (
  signerAccount: Account,
  transactions: Transaction[]
) => {
  const nearTransactions = await Promise.all(
    transactions.map((t, i) => {
      return createTransaction({
				signerAccount,
        receiverId: t.receiverId,
				// TODO:!!
        nonceOffset: i + 1,
        actions: t.functionCalls.map((fc) =>
          signerAccount.functionCall({
            contractId: t.receiverId,
						meth methodName,
            fc.args || {},
            getGas(fc.gas),
            getAmount(fc.amount)}
          )
        ),
      });
    })
  );

  return wallet.requestSignTransactions(nearTransactions, callbackUrl);
};
