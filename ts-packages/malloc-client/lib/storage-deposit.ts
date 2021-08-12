import BN from "bn.js";
import { Account, utils } from "near-api-js";
import { AccountId, BigNumberish, Transaction } from "./interfaces";
import { MAX_GAS_STR } from "./tx";

export const doStorageDeposit = async (
  caller: Account,
  contractAddr: string,
  accountId: string,
  extraAmount?: BigNumberish
): Promise<Transaction | null> => {
  // TODO: from where??
  const NEW_ACCOUNT_STORAGE_COST_bn = new BN(
    utils.format.parseNearAmount("0.00125")
  ).add(new BN(extraAmount || 0));
  const NEW_ACCOUNT_STORAGE_COST = NEW_ACCOUNT_STORAGE_COST_bn.toString();
  const storageBal = await caller.viewFunction(
    contractAddr,
    "storage_balance_of",
    {
      account_id: accountId,
    }
  );

  if (
    !storageBal ||
    new BN(storageBal?.total || 0).lt(NEW_ACCOUNT_STORAGE_COST_bn)
  ) {
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
  caller: Account,
  extraAmount?: BigNumberish
): Promise<{ txs: Transaction[]; contractsToRegister: AccountId[] }> => {
  const txOptions = await Promise.all(
    ftAccountIds.map((ftAccount) =>
      doStorageDeposit(caller, ftAccount, accountId, extraAmount)
    )
  );
  const txs = txOptions.filter((tx) => tx !== null);
  const contractsToRegister = ftAccountIds
    .map((token, i) => (txOptions[i] ? token : null))
    .filter((token) => token !== null);
  return { txs, contractsToRegister };
};

// TODO: use setupFt to get a list of transactions, filter through em
export const registerDepositsTxs = async (
  ftAccountIds: string[],
  accountIds: string[],
  caller: Account,
  extraAmount?: BigNumberish
): Promise<{ txs: Transaction[]; contractsToRegister: AccountId[] }> => {
  const registerResp = await Promise.all(
    accountIds.map((accountId) =>
      registerFtTxsForSingleAccount(
        ftAccountIds,
        accountId,
        caller,
        extraAmount
      )
    )
  );
  const txs = registerResp.map((r) => r.txs).flat();
  const tokensToRegisterDup = registerResp
    .map((r) => r.contractsToRegister)
    .flat();

  const tokensToRegisterSet = new Set(tokensToRegisterDup);
  return { txs, contractsToRegister: Array.from(tokensToRegisterSet) };
};
