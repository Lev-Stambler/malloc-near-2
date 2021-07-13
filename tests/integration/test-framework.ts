import BN from "bn.js";
import { Account, Near } from "near-api-js";
import { SerializedSplitter } from "../../src/types";
import { allResultsSuccess, getResults, MAX_GAS } from "./shared";

interface AccountBalance {
  nativeBal?: string;
  ftBals: {
    [contractAccountId: string]: string;
  };
}

export interface Balances {
  [recipientAccountId: string]: {
    bal: AccountBalance;
    account: Account;
  };
}

/**
 * Run an ephemeral tree
 * Then get all the resulting balances of the different accounts involved
 * Then transfer all the funds back to the caller
 * Then assert that all the resulting funds are correct
 */
export const runEphemeralTree = async (
  caller: Account,
  contractName: string,
  splitter: SerializedSplitter,
  amount: number,
  attachedDeposit: number,
  expectedResults: Balances,
  near: Near,
  expect: any
) => {
  const ret = await caller.functionCall({
    contractId: contractName,
    methodName: "run_ephemeral",
    args: {
      splitter,
      amount,
    },
    gas: MAX_GAS,
    attachedDeposit: new BN(attachedDeposit),
  });

  const results = await getResults(ret.transaction.hash, caller.accountId);
  // TODO: transfer from bob and alice
  const currentBals: Balances[] = await Promise.all(
    Object.keys(expectedResults).map(async (accountId) => {
      const expectedBal = expectedResults[accountId].bal;
      const account = expectedResults[accountId].account;

      const ftBals = await Promise.all(
        Object.keys(expectedBal.ftBals).map(async (contractId) => {
          const bal = await caller.viewFunction(contractId, "ft_balance_of", {
            account_id: accountId,
          });
          const ret: { [contractId: string]: string } = {};
          ret[contractId] = bal;
          if (new BN(bal).gt(new BN(0))) {
            await account.functionCall({
              contractId: contractId,
              methodName: "ft_transfer",
              args: {
                receiver_id: caller.accountId,
                amount: bal,
                msg: "",
                memo: "",
              },
              attachedDeposit: new BN(1),
              gas: MAX_GAS,
            });
          }
          return ret;
        })
      );
      const ftBalsFlat = ftBals.reduce((allBals, currBal) => {
        return { ...allBals, ...currBal };
      }, {});

      let currentNativeBal: string | undefined = undefined;

      // Do not worry about sending back the native balances, this should be handled on clean up of the tests
      if (expectedBal.nativeBal) {
        currentNativeBal = (
          await (await near.account(accountId)).getAccountBalance()
        ).total;
      }

      const ret: Balances = {};
      ret[accountId] = {
        bal: {
          nativeBal: currentNativeBal,
          ftBals: ftBalsFlat,
        },
        account,
      };
      return ret;
    })
  );
  const currentBalsFlat: Balances = currentBals.reduce((prev, curr) => {
    return { ...prev, ...curr };
  }, {});

  expect(allResultsSuccess(results)).toBeTruthy();
  for (const accountId in expectedResults) {
    expect(currentBalsFlat[accountId].bal.nativeBal).toEqual(
      expectedResults[accountId].bal.nativeBal
    );
    // Check that the ft token values are greater than or equal to the expected values
    // because swaps return a min amount of tokens, but it is not deterministic
    for (const contract in expectedResults[accountId].bal.ftBals) {
      expect(
        new BN(currentBalsFlat[accountId].bal.ftBals[contract]).gte(
          new BN(expectedResults[accountId].bal.ftBals[contract])
        )
      ).toBeTruthy();
    }
  }
};
