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
import { KeyPair, KeyPairEd25519, PublicKey } from "near-api-js/lib/utils";
import { MallocErrors } from "./errors";
import {
  Transaction,
  AccountId,
  SpecialAccount,
  SpecialAccountConnectedWallet,
  SpecialAccountWithKeyPair,
  TxAction,
  BigNumberish,
} from "./interfaces";
import { isRunningBrowser } from "./utils";

const KEY_FOR_MALLOC_ACCESS_KEY = "MallocAccessKey";

export const addAccessKeyForFunctionCalls = async (
  account: SpecialAccount,
  mallocId: AccountId,
  methodNames: string[],
  allowance: BigNumberish
): Promise<{ tx: Transaction; kp: KeyPair }> => {
  const accessKeys = await account.getAccessKeys();
  const oldAccessKey = findAccessMatching(accessKeys, mallocId);
  let prependActions: TxAction[] = [];
  if (oldAccessKey) {
    prependActions.push({
      deleteKey: {
        publicKey: oldAccessKey.pk,
      },
    });
  }

  const kp = KeyPairEd25519.fromRandom();
  const tx: Transaction = {
    receiverId: account.accountId,
    actions: [
      {
        functionCallAccessKey: {
          accessKey: {
            receiverId: mallocId,
            methodNames,
            allowance: allowance.toString(),
          },
          publicKey: kp.publicKey,
          // by having a init step which looks for this pk
        },
      },
    ],
  };
  return {
    tx,
    kp,
  };
};

export const storeKeyPair = (kp: KeyPair) => {
  if (!isRunningBrowser)
    throw MallocErrors.ONLY_WEB_WALLET_SUPPORTED("Loading an access key");
  (globalThis as any).window.localStorage.setItem(
    KEY_FOR_MALLOC_ACCESS_KEY,
    kp.toString()
  );
};

export const loadKeyPair = (): KeyPair | undefined => {
  if (!isRunningBrowser)
    throw MallocErrors.ONLY_WEB_WALLET_SUPPORTED("Loading an access key");
  const privStr: string | null = (
    globalThis as any
  ).window.localStorage.getItem(KEY_FOR_MALLOC_ACCESS_KEY);

  if (!privStr) return undefined;
  return KeyPairEd25519.fromString(privStr);
};

const findAccessMatching = (
  accessKeyInfos: AccessKeyInfoView[],
  contract_id: AccountId
): { pk: PublicKey; i: number } | null => {
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
  return null;
};
