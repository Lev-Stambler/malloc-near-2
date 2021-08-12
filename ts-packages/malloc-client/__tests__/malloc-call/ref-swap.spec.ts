import * as MallocClient from "../../lib/malloc-client";
import * as TestingUtils from "../../../testing-utils/lib/testing-utils";
import {
  SpecialAccountType,
  TransactionWithPromiseResultFlag,
} from "../../lib/interfaces";
import BN from "bn.js";
import { wrap } from "module";
import { MAX_GAS } from "../../lib/tx";
import { MALLOC_CALL_SIMPLE_GAS } from "../../../testing-utils/lib/testing-utils";
import { Account } from "near-api-js";
import { readFileSync } from "fs";
import { join } from "path";

let malloc: MallocClient.MallocClient<MallocClient.SpecialAccountWithKeyPair>;
const NDAI_CONTRACT = "ndai.ft-fin.testnet";
const TOKEN_ACCOUNT_IDS = [TestingUtils.WRAP_TESTNET_CONTRACT, NDAI_CONTRACT];
let masterAccount: Account;
let wrappedTesterAccount: MallocClient.SpecialAccountWithKeyPair;
const REF_FINANCE_CONTRACT = "ref-finance.testnet";
const EXTRA_DEPOSIT_FOR_FT_STORE = "1660000000000000000000";

export const getMallocCallRefSwapContract = () =>
  readFileSync(
    join(
      __dirname,
      "../../../../rust/packages/malloc-calls/ref-swap-malloc-call/neardev/dev-account"
    )
  ).toString();

describe("ref-swap call", () => {
  jest.setTimeout(60 * 1000);
  beforeAll(async () => {
    masterAccount = await TestingUtils.getDefaultTesterAccountNear();
    // const testerAccount = await TestingUtils.newRandAccount(masterAccount);
    wrappedTesterAccount = masterAccount;
    malloc = new MallocClient.MallocClient(
      wrappedTesterAccount,
      TestingUtils.getMallocContract()
    );
  });

  it.only("should make calls to a multi level splitter with pass throughs and black whole at then end", async () => {
    const MALLOC_CALL_SWAP_CONTRACT_ID = getMallocCallRefSwapContract();

    const amount = 1000000000;

    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount,
      true,
      amount + 20
    );

    await malloc.registerAccountDeposits(
      [REF_FINANCE_CONTRACT],
      [MALLOC_CALL_SWAP_CONTRACT_ID],
      { extraAmount: EXTRA_DEPOSIT_FOR_FT_STORE }
    );

    await malloc.registerAccountDeposits(TOKEN_ACCOUNT_IDS, [
      wrappedTesterAccount.accountId,
      malloc.mallocAccountId,
      MALLOC_CALL_SWAP_CONTRACT_ID,
    ]);

    const myBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount
    );

    const depositTransactionHash = await malloc.deposit(
      amount.toString(),
      TestingUtils.WRAP_TESTNET_CONTRACT
    );

    const wNearToDAIPoolId = 20;

    const poolReturn = await masterAccount.viewFunction(
      REF_FINANCE_CONTRACT,
      "get_return",
      {
        pool_id: wNearToDAIPoolId,
        token_in: TestingUtils.WRAP_TESTNET_CONTRACT,
        amount_in: amount.toString(),
        token_out: NDAI_CONTRACT,
      }
    );
    console.log("A pool return of", poolReturn);
    const minDaiRetrun = new BN(poolReturn).muln(90).divn(100);

    const txRess = await malloc.runEphemeralConstruction(
      [
        {
          FtTransferCallToMallocCall: {
            malloc_call_id: MALLOC_CALL_SWAP_CONTRACT_ID,
            token_id: TestingUtils.WRAP_TESTNET_CONTRACT,
          },
        },
        {
          MallocCall: {
            malloc_call_id: MALLOC_CALL_SWAP_CONTRACT_ID,
            token_id: TestingUtils.WRAP_TESTNET_CONTRACT,
            check_callback: false,
            skip_ft_transfer: true,
            json_args: JSON.stringify({
              token_out: NDAI_CONTRACT,
              pool_id: wNearToDAIPoolId,
              min_amount_out: minDaiRetrun.toString(),
              // TODO: this will be removed
              register_tokens: [
                NDAI_CONTRACT,
                TestingUtils.WRAP_TESTNET_CONTRACT,
              ],
              recipient: masterAccount.accountId,
            }),
            // 2/3 rds of max gas and have the remaining third for processing the call
            gas: MAX_GAS.divn(100).muln(80).toNumber(),
            attached_amount: "16",
          },
        },
      ],
      amount.toString(),
      [0],
      [1],
      [[[1]], [[]]],
      [[[1]], [[]]],
      { gas: MAX_GAS, depositTransactionHash }
    );
    const ret = await malloc.resolveTransactions(txRess);
    expect(ret.flag).toBe(TransactionWithPromiseResultFlag.SUCCESS);

    const newmyBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount
    );
    TestingUtils.checkBalDifferences(myBal, newmyBal, -1 * amount, expect);
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(masterAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
