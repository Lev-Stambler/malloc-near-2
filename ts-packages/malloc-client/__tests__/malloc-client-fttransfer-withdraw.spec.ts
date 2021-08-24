import * as MallocClient from "../lib/malloc-client";
import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import {
  SpecialAccountType,
  TransactionWithPromiseResultFlag,
} from "../lib/interfaces";
import BN from "bn.js";
import { wrap } from "module";
import { MAX_GAS } from "../lib/tx";
import { MALLOC_CALL_SIMPLE_GAS } from "../../testing-utils/lib/testing-utils";
import { Account } from "near-api-js";
import { readFileSync } from "fs";
import { join } from "path";
import { MallocErrors } from "../lib/errors";

let malloc: MallocClient.MallocClient<MallocClient.SpecialAccountWithKeyPair>;
const TOKEN_ACCOUNT_IDS = [TestingUtils.WRAP_TESTNET_CONTRACT];
let masterAccount: Account;
let wrappedTesterAccount: MallocClient.SpecialAccountWithKeyPair;

let depositTxHash: string;

const amountWNearPerTest = 100000;
const NUMB_TESTS = 2;
const MALLOC_CALL_BLACKWHOLE = TestingUtils.getMallocCallBlackwholeContract();

describe("FtTransferCallToMallocCall and WithdrawFromMallocCall", () => {
  jest.setTimeout(60 * 1000);
  beforeAll(async () => {
    masterAccount = await TestingUtils.getDefaultTesterAccountNear();
    //@ts-ignore
    wrappedTesterAccount = masterAccount;
    malloc = new MallocClient.MallocClient(
      wrappedTesterAccount,
      TestingUtils.getMallocContract(),
      {
        executeTxsByDefault: true,
      }
    );
    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount,
      true,
      amountWNearPerTest * NUMB_TESTS
    );

    await malloc.registerAccountDeposits(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        wrappedTesterAccount.accountId,
        malloc.mallocAccountId,
        MALLOC_CALL_BLACKWHOLE,
      ],
      {
        executeTransactions: true,
      }
    );
    await malloc.deposit(
      (amountWNearPerTest * NUMB_TESTS).toString(),
      TestingUtils.WRAP_TESTNET_CONTRACT
    );
  });

  xit("should fail when trying to withdraw someone else's balance", () => {});

  xit("should transfer some wNear to the blackwhole, then from the blackwhole withdraw back to this account, then check the balances", async () => {});

  it("should transfer some wNear to the blackwhole, check that the balance increased there, then withdraw that amount back to the Malloc Contract", async () => {
    const oldBlackwholeBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      MALLOC_CALL_BLACKWHOLE,
      wrappedTesterAccount
    );

    const oldBlackwholeBalForAccount = await malloc.getTokenBalance(
      wrappedTesterAccount.accountId,
      TestingUtils.WRAP_TESTNET_CONTRACT,
      MALLOC_CALL_BLACKWHOLE
    );

    const oldMallocBal = await malloc.getTokenBalance(
      wrappedTesterAccount.accountId,
      TestingUtils.WRAP_TESTNET_CONTRACT
    );

    const txs = await malloc.runEphemeralConstruction({
      actions: [
        {
          FtTransferCallToMallocCall: {
            malloc_call_id: MALLOC_CALL_BLACKWHOLE,
            token_id: TestingUtils.WRAP_TESTNET_CONTRACT,
          },
        },
      ],
      amount: amountWNearPerTest.toString(),
      initialActionIndices: [0],
      initialSplits: [1],
      nextActionsIndices: [[[]]],
      nextActionsSplits: [[[]]],
    });
    await malloc.resolveTransactions(txs);

    const newBlackwholeBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      MALLOC_CALL_BLACKWHOLE,
      wrappedTesterAccount
    );

    const newMallocBal = await malloc.getTokenBalance(
      wrappedTesterAccount.accountId,
      TestingUtils.WRAP_TESTNET_CONTRACT
    );

    const newBlackwholeBalForAccount = await malloc.getTokenBalance(
      wrappedTesterAccount.accountId,
      TestingUtils.WRAP_TESTNET_CONTRACT,
      MALLOC_CALL_BLACKWHOLE
    );

    TestingUtils.checkBalDifferences(
      oldMallocBal,
      newMallocBal,
      amountWNearPerTest * -1,
      expect
    );

    TestingUtils.checkBalDifferences(
      oldBlackwholeBal,
      newBlackwholeBal,
      amountWNearPerTest,
      expect
    );

    TestingUtils.checkBalDifferences(
      oldBlackwholeBalForAccount,
      newBlackwholeBalForAccount,
      amountWNearPerTest,
      expect
    );

    const txsWithdraw = await malloc.runEphemeralConstruction({
      actions: [
        {
          WithdrawFromMallocCall: {
            malloc_call_id: MALLOC_CALL_BLACKWHOLE,
            token_id: TestingUtils.WRAP_TESTNET_CONTRACT,
          },
        },
      ],
      amount: amountWNearPerTest.toString(),
      initialActionIndices: [0],
      initialSplits: [1],
      nextActionsIndices: [[[]]],
      nextActionsSplits: [[[]]],
    });
    await malloc.resolveTransactions(txsWithdraw);

    const afterWithdrawBlackwholeBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      MALLOC_CALL_BLACKWHOLE,
      wrappedTesterAccount
    );

    const afterWithdrawMallocBal = await malloc.getTokenBalance(
      wrappedTesterAccount.accountId,
      TestingUtils.WRAP_TESTNET_CONTRACT
    );

    const afterWithdrawBlackwholeBalAccount = await malloc.getTokenBalance(
      wrappedTesterAccount.accountId,
      TestingUtils.WRAP_TESTNET_CONTRACT,
      MALLOC_CALL_BLACKWHOLE
    );

    TestingUtils.checkBalDifferences(
      newBlackwholeBal,
      afterWithdrawBlackwholeBal,
      amountWNearPerTest * -1,
      expect
    );
    TestingUtils.checkBalDifferences(
      newMallocBal,
      afterWithdrawMallocBal,
      amountWNearPerTest,
      expect
    );
    TestingUtils.checkBalDifferences(
      newBlackwholeBalForAccount,
      afterWithdrawBlackwholeBalAccount,
      amountWNearPerTest * -1,
      expect
    );

    await malloc.withdraw(
      amountWNearPerTest.toString(),
      TestingUtils.WRAP_TESTNET_CONTRACT
    );
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(masterAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
