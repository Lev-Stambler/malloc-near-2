import * as MallocClient from "../../lib/malloc-client";
import * as TestingUtils from "../../../testing-utils/lib/testing-utils";
import {
  SpecialAccountType,
  Splitter,
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

export const getMallocCallRefSwapContract = () =>
  readFileSync(
    join(
      __dirname,
      "../../../rust/packages/malloc-calls/ref-swap-malloc-call/neardev/dev-account"
    )
  ).toString();

describe("ref-swap call", () => {
  jest.setTimeout(60 * 1000);
  beforeAll(async () => {
    masterAccount = await TestingUtils.getDefaultTesterAccountNear();
    const testerAccount = await TestingUtils.newRandAccount(masterAccount);
    wrappedTesterAccount = testerAccount;
    malloc = await MallocClient.createMallocClient(
      wrappedTesterAccount,
      TestingUtils.getMallocContract()
    );
  });

  it.only("should make calls to a multi level splitter with pass throughs and black whole at then end", async () => {
    const MALLOC_CALL_SWAP_CONTRACT_ID = getMallocCallRefSwapContract();

    const amount = 1000000;

    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount,
      true,
      amount + 20
    );
    await malloc.registerAccountWithFungibleToken(TOKEN_ACCOUNT_IDS, [
      wrappedTesterAccount.accountId,
      malloc.contractAccountId,
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
          splits: [1],
          children: [
            {
              MallocCall: {
                contract_id: MALLOC_CALL_SWAP_CONTRACT_ID,
                json_args: JSON.stringify({
                  token_out: NDAI_CONTRACT,
                  pool_id: wNearToDAIPoolId,
                  min_amount_out: minDaiRetrun.toString(),
                  // TODO: this will be removed
                  register_tokens: [], //[NDAI_CONTRACT, TestingUtils.WRAP_TESTNET_CONTRACT],
                  recipient: masterAccount.accountId,
                }),
                gas: MALLOC_CALL_SIMPLE_GAS.muln(10).toNumber(),
                attached_amount: "16",
              },
            },
          ],
          ft_contract_id: TestingUtils.WRAP_TESTNET_CONTRACT,
        },
      ],
      [[[]]],
      amount.toString(),
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
