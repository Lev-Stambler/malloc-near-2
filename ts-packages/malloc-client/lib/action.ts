import BN from "bn.js";
import { MallocErrors } from "./errors";
import {
  SpecialAccount,
  TxAction,
  MallocCallMetadata,
  AccountId,
  ActionTypesLibraryFacing,
  ActionTypesContractFacing,
  Action,
} from "./interfaces";

/**
 * Fill in the the metadata from malloc call's metadata into the given action
 */
export const actionLibraryFacingToContractFacing = async (
  callerAccount: SpecialAccount,
  action: Action<ActionTypesLibraryFacing>
): Promise<Action<ActionTypesContractFacing>> => {
  if (action.MallocCall) {
    const metadata = await getMallocCallMetadata(
      callerAccount,
      action.MallocCall.malloc_call_id
    );
    return {
      MallocCall: {
        ...action.MallocCall,
        gas: metadata.gas_required,
        attached_amount: new BN(metadata.attachment_required).toString(),
      },
    };
  }
  return action
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

export const getActionInputToken = (
  action: Action<ActionTypesLibraryFacing>
): AccountId => {
  if (action.MallocCall) {
    return action.MallocCall.token_id;
  } else if (action.WithdrawFromMallocCall) {
    return action.WithdrawFromMallocCall.token_id;
  } else if (action.FtTransferCallToMallocCall) {
    return action.FtTransferCallToMallocCall.token_id;
  }
  throw MallocErrors.EXPECTED_ACTION_PROPERTY();
};
