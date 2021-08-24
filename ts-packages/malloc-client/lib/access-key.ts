import BN from "bn.js";
import {
  AccessKeyInfoView,
  FunctionCallPermissionView,
} from "near-api-js/lib/providers/provider";
import {
  AccessKey,
  addKey,
  deleteKey,
  functionCallAccessKey as functionCallAccessKeyFn,
} from "near-api-js/lib/transaction";
import { PublicKey } from "near-api-js/lib/utils";
import { MallocErrors } from "./errors";
import {
  Transaction,
  AccountId,
  SpecialAccount,
  SpecialAccountConnectedWallet,
  SpecialAccountWithKeyPair,
} from "./interfaces";

export const addAccessKeyForFunctionCalls = async (
  account: SpecialAccountConnectedWallet,
  mallocId: AccountId,
  methodNames: string[],
  allowance: BN
): Promise<Transaction> => {
  const tx: Transaction = {
    receiverId: account.accountId,
    actions: [
      {
        functionCallAccessKey: {
          accessKey: functionCallAccessKeyFn(mallocId, methodNames, allowance),
          publicKey: "TODO:" // You will have to store this public key somewhere and then do something or other with it. You can maybe load it
          // by having a init step which looks for this pk
        },
      },
    ],
  };
  // return tx
  throw "todo";
  // account.addKey(
  // const tx: NearTransaction = new NearTransaction(
};

const findAccessMatching = (
  accessKeyInfos: AccessKeyInfoView[],
  contract_id: AccountId
): { pk: PublicKey; i: number } => {
  let i = 0;
  for (const info of accessKeyInfos) {
    if (
      (info.access_key.permission as FunctionCallPermissionView).FunctionCall &&
      (info.access_key.permission as FunctionCallPermissionView).FunctionCall
        .receiver_id === contract_id
    ) {
      return { pk: PublicKey.from(info.public_key), i };
    }
    i++;
  }
  throw MallocErrors.COULD_NOT_FIND_ACCESS_KEY(contract_id);
};
