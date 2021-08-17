import { MallocError } from "./interfaces";

export namespace MallocErrors {
  export const TRANSACTION_PROMISE_FAILED = (message?: string) =>
    createError(
      `The transaction's promises failed with a message of: ${message}`
    );
  export const EXPECTED_ACTION_PROPERTY = () =>
    createError(
      `Expected an action name to match FtTransferCallToMallocCall, MallocCall, or one another appropriate Action`
    );
}

const createError = (message: string): MallocError => {
  return {
    message,
  };
};
