import * as nearAPI from "near-api-js";
import { AccountId, FunctionCallOptions, Transaction } from "./interfaces";
import { executeMultipleTx, MAX_GAS, MAX_GAS_STR } from "./tx";

export const getTokenBalance = (
  caller: nearAPI.Account,
  mallocContractId: AccountId,
  accountId: AccountId,
  tokenId: AccountId
): Promise<string> => {
  return caller.viewFunction(mallocContractId, "get_ft_balance", {
    account_id: accountId,
    token_id: tokenId,
  });
};
