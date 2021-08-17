import BN from "bn.js";
import {
  SpecialAccount,
  Action,
  MallocCallMetadata,
  AccountId,
  ActionTypes,
} from "./interfaces";

/**
 * @param  {SpecialAccount} callerAccount
 * @param  {Action} action
 * @returns Promise
 */
export const getActionAttachedDepositForAction = async (
  callerAccount: SpecialAccount,
  action: Action<ActionTypes>
): Promise<BN> => {
  if (action.MallocCall) {
    const metadata = await getMallocCallMetadata(
      callerAccount,
      action.MallocCall.malloc_call_id
    );
    return new BN(metadata.minimum_attached_deposit || 1);
  } else if (action.FtTransferCallToMallocCall) {
    return new BN(1);
  }
  return new BN(0);
};

export const getMallocCallMetadata = async (
  callerAccount: SpecialAccount,
  malloc_call_id: AccountId
): Promise<MallocCallMetadata> => {
  const metadata: MallocCallMetadata = await callerAccount.viewFunction(
    malloc_call_id,
    "metadata"
  );
  return metadata;
};
