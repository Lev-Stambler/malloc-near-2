import * as nearAPI from "near-api-js";
import {
  AccountId,
  FunctionCallOptions,
  Transaction,
  TransferType,
} from "./interfaces";
import { executeMultipleTx, MAX_GAS, MAX_GAS_STR } from "./tx";

export const getTokenBalance = (
  caller: nearAPI.Account,
  mallocOrCallContractId: AccountId,
  accountId: AccountId,
  tokenId: AccountId
): Promise<string> => {
  return caller.viewFunction(mallocOrCallContractId, "get_ft_balance", {
    account_id: accountId,
    token_id: tokenId,
  });
};

export const TransferTypeTransfer = (): TransferType => {
  return { Transfer: [] };
};
export const TransferTypeTransferCallMalloc = (): TransferType => {
  return { TransferCallMalloc: [] };
};
