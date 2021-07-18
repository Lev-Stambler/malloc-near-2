import * as nearAPI from "near-api-js";
import { AccountId, FunctionCallOptions, Transaction } from "./interfaces";
import { executeMultipleTx, MAX_GAS, MAX_GAS_STR } from "./tx";

const setupFT = async (
  caller: nearAPI.Account,
  contractAddr: string,
  accountId: string
): Promise<Transaction | null> => {
  // TODO: from where??
  const NEW_ACCOUNT_STORAGE_COST =
    nearAPI.utils.format.parseNearAmount("0.00125");
  const storageBal = await caller.viewFunction(
    contractAddr,
    "storage_balance_of",
    {
      account_id: accountId,
    }
  );
  if (!storageBal || storageBal.total === "0") {
    return {
      receiverId: contractAddr,
      functionCalls: [
        {
          methodName: "storage_deposit",
          amount: NEW_ACCOUNT_STORAGE_COST,
          gas: MAX_GAS_STR,
          args: { account_id: accountId },
        },
      ],
    };
  } else return null;
};

// TODO: use setupFt to get a list of transactions, filter through em
export const registerFtsTxs = async (
  ftAccountIds: string[],
  accountId: string,
  caller: nearAPI.Account
): Promise<{ txs: Transaction[]; tokensToRegister: AccountId[] }> => {
  const txOptions = await Promise.all(
    ftAccountIds.map((ftAccount) => setupFT(caller, ftAccount, accountId))
  );
  const txs = txOptions.filter((tx) => tx !== null);
  const tokensToRegister = ftAccountIds
    .map((token, i) => (txOptions[i] ? token : null))
    .filter((token) => token !== null);
  return { txs, tokensToRegister };
};
