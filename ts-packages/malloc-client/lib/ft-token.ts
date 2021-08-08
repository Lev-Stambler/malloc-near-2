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

const registerFtTxsForSingleAccount = async (
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

// TODO: use setupFt to get a list of transactions, filter through em
export const registerFtsTxs = async (
  ftAccountIds: string[],
  accountIds: string[],
  caller: nearAPI.Account
): Promise<{ txs: Transaction[]; tokensToRegister: AccountId[] }> => {
  const registerResp = await Promise.all(
    accountIds.map((accountId) =>
      registerFtTxsForSingleAccount(ftAccountIds, accountId, caller)
    )
  );
  const txs = registerResp.map((r) => r.txs).flat();
  const tokensToRegisterDup = registerResp
    .map((r) => r.tokensToRegister)
    .flat();

  const tokensToRegisterSet = new Set(tokensToRegisterDup);
  return { txs, tokensToRegister: Array.from(tokensToRegisterSet) };
};
