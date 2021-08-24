import { AccountId, MallocError } from "./interfaces";

export namespace MallocErrors {
  export const TRANSACTION_PROMISE_FAILED = (message?: string) =>
    createError(
      `The transaction's promises failed with a message of: ${message}`
    );
  export const EXPECTED_ACTION_PROPERTY = () =>
    createError(
      `Expected an action name to match FtTransferCallToMallocCall, MallocCall, or one another appropriate Action`
    );

  export const COULD_NOT_FIND_ACCESS_KEY = (contract_id: AccountId) =>
    createError(
      `Failed to find an access key which has access to contract ${contract_id}`
    );
}

const createError = (message: string): MallocError => {
  return {
    message,
  };
};
