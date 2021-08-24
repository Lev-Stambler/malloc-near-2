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
  export const EXPECTED_TX_ACTION_PROPERTY = () =>
    createError(
      `Expected a tx action name to match functionCall, functionCallAccessKey, or deleteKey`
    );

  export const COULD_NOT_FIND_ACCESS_KEY = (contract_id: AccountId) =>
    createError(
      `Failed to find an access key which has access to contract ${contract_id}`
    );

  export const ONLY_WEB_WALLET_SUPPORTED = (action: string) =>
    createError(`${action} is only supported by web connected wallets`);

  export const EXPECTED_A_MALLOC_ACCESS_KEY = (action: string) => 
      createError(`${action} requires having an access key specifically for malloc`)
}

const createError = (message: string): MallocError => {
  return {
    message,
  };
};
