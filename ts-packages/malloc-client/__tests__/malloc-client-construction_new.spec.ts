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

let malloc: MallocClient.MallocClient<MallocClient.SpecialAccountWithKeyPair>;
const TOKEN_ACCOUNT_IDS = [
  TestingUtils.WRAP_TESTNET_CONTRACT,
  "ndai.ft-fin.testnet",
];
let masterAccount: Account;
let wrappedTesterAccount: MallocClient.SpecialAccountWithKeyPair;

describe("malloc-client's ft capabilities", () => {
  jest.setTimeout(60 * 1000);
  beforeAll(async () => {
    masterAccount = await TestingUtils.getDefaultTesterAccountNear();
    const testerAccount = await TestingUtils.newRandAccount(masterAccount);
    wrappedTesterAccount = testerAccount;
    malloc = new MallocClient.MallocClient(
      wrappedTesterAccount,
      TestingUtils.getMallocContract()
    );
  });

  it.only("should make a couple black whole calls and make sure that the most basic splitter succeeds", async () => {
    const MALLOC_CALL_BLACKWHOLE_CONTRACT_ID =
      TestingUtils.getMallocCallBlackwholeContract();

    const amount = 100;

    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount,
      true,
      amount + 20
    );
    await malloc.registerAccountWithFungibleToken(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        wrappedTesterAccount.accountId,
        malloc.mallocAccountId,
        MALLOC_CALL_BLACKWHOLE_CONTRACT_ID,
      ]
    );

    const myBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount
    );

    const depositTransactionHash = await malloc.deposit(
      amount.toString(),
      TestingUtils.WRAP_TESTNET_CONTRACT
    );

    const txRess = await malloc.runEphemeralConstruction(
      [
        {
          MallocCall: {
            malloc_call_id: MALLOC_CALL_BLACKWHOLE_CONTRACT_ID,
            token_id: TestingUtils.WRAP_TESTNET_CONTRACT,
            next_node_splits: [],
            next_node_indices: [],
            check_callback: false,
            // TODO: no json stringify!!
            json_args: JSON.stringify({
              log_message: "hello for alice",
            }),
            gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
            attached_amount: "0",
          },
        },
        {
          MallocCall: {
            malloc_call_id: MALLOC_CALL_BLACKWHOLE_CONTRACT_ID,
            token_id: TestingUtils.WRAP_TESTNET_CONTRACT,
            next_node_splits: [],
            next_node_indices: [],
            check_callback: false,
            json_args: JSON.stringify({
              log_message: "hello for bob",
            }),
            gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
            attached_amount: "0",
          },
        },
      ],
      amount.toString(),
      [0],
      [1],
      [[[]], [[]]],
      [[[]], [[]]],
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
