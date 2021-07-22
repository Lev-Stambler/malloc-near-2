import { MallocError } from "./interfaces";

export namespace MallocErrors {
	export const transactionPromiseFailed = (message?: string) => createError(`The transaction's promises failed with a message of: ${message}`)
}

const createError = (message: string): MallocError => {
  return {
    message,
  };
};
