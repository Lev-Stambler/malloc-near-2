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

xdescribe("malloc-client's ft capabilities", () => {
  jest.setTimeout(60 * 1000);
  beforeAll(async () => {
    masterAccount = await TestingUtils.getDefaultTesterAccountNear();
    const testerAccount = await TestingUtils.newRandAccount(masterAccount);
    wrappedTesterAccount = testerAccount;
    malloc = new MallocClient.MallocClient(
      wrappedTesterAccount,
      TestingUtils.getMallocContract(),
      { executeTxsByDefault: true }
    );
  });

  it("should make calls to a multi level splitter with pass throughs and black whole at then end", async () => {
    const MALLOC_CALL_BLACKWHOLE_CONTRACT_ID =
      TestingUtils.getMallocCallBlackwholeContract();
    const MALLOC_CALL_PASSTHROUGH_CONTRACT_ID =
      TestingUtils.getMallocCallPassthroughContract();

    const amount = 100;

    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount,
      true,
      amount + 20
    );
    await malloc.registerAccountDeposits(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        wrappedTesterAccount.accountId,
        malloc.mallocAccountId,
        MALLOC_CALL_BLACKWHOLE_CONTRACT_ID,
        MALLOC_CALL_PASSTHROUGH_CONTRACT_ID,
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
          splits: [3, 1, 2],
          children: [
            {
              MallocCall: {
                contract_id: MALLOC_CALL_PASSTHROUGH_CONTRACT_ID,

                json_args: JSON.stringify({
                  log_message: "hello for alice level 1",
                }),
                gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
                attached_amount: "0",
              },
            },
            {
              MallocCall: {
                contract_id: MALLOC_CALL_PASSTHROUGH_CONTRACT_ID,

                json_args: JSON.stringify({
                  log_message: "hello for karen level 1",
                }),
                gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
                attached_amount: "0",
              },
            },
            {
              MallocCall: {
                check_callback: false,
                contract_id: MALLOC_CALL_BLACKWHOLE_CONTRACT_ID,
                json_args: JSON.stringify({
                  log_message: "hello for bob level 1",
                }),
                gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
                attached_amount: "0",
              },
            },
          ],
          ft_contract_id: TestingUtils.WRAP_TESTNET_CONTRACT,
        },
        {
          splits: [1, 1],
          children: [
            {
              MallocCall: {
                contract_id: MALLOC_CALL_PASSTHROUGH_CONTRACT_ID,

                json_args: JSON.stringify({
                  log_message: "hello for alice level 1",
                }),
                gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
                attached_amount: "0",
              },
            },
            {
              MallocCall: {
                contract_id: MALLOC_CALL_BLACKWHOLE_CONTRACT_ID,
                check_callback: false,

                json_args: JSON.stringify({
                  log_message: "hello for karen level 1",
                }),
                gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
                attached_amount: "0",
              },
            },
          ],
          ft_contract_id: TestingUtils.WRAP_TESTNET_CONTRACT,
        },
        {
          splits: [1],
          children: [
            {
              MallocCall: {
                check_callback: false,
                contract_id: MALLOC_CALL_BLACKWHOLE_CONTRACT_ID,

                json_args: JSON.stringify({
                  log_message: "hello for alice level 1",
                }),
                gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
                attached_amount: "0",
              },
            },
          ],
          ft_contract_id: TestingUtils.WRAP_TESTNET_CONTRACT,
        },
      ],
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
    await malloc.registerAccountDeposits(
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
          splits: [3, 1],
          children: [
            {
              MallocCall: {
                contract_id: MALLOC_CALL_BLACKWHOLE_CONTRACT_ID,
                check_callback: false,

                json_args: JSON.stringify({
                  log_message: "hello for alice",
                }),
                gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
                attached_amount: "0",
              },
            },
            {
              MallocCall: {
                contract_id: MALLOC_CALL_BLACKWHOLE_CONTRACT_ID,
                check_callback: false,
                json_args: JSON.stringify({
                  log_message: "hello for bob",
                }),
                gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
                attached_amount: "0",
              },
            },
          ],
          ft_contract_id: TestingUtils.WRAP_TESTNET_CONTRACT,
        },
      ],
      [[[], []]],
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

  xit("should send Wrapped Near using the SimpleTransferMallocCall", async () => {
    const MALLOC_CALL_SEND_CONTRACT_ID =
      TestingUtils.getMallocCallSendContract();

    const amount = 600;
    const alice = await TestingUtils.newRandAccount(masterAccount);
    const bob = await TestingUtils.newRandAccount(masterAccount);

    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount,
      true,
      amount + 20
    );
    await malloc.registerAccountDeposits(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        alice.accountId,
        bob.accountId,
        wrappedTesterAccount.accountId,
        malloc.mallocAccountId,
        MALLOC_CALL_SEND_CONTRACT_ID,
      ]
    );
    const aliceBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      alice.accountId,
      wrappedTesterAccount
    );
    const bobBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      bob.accountId,
      wrappedTesterAccount
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
          splits: [3, 1],
          children: [
            {
              MallocCall: {
                contract_id: MALLOC_CALL_SEND_CONTRACT_ID,

                json_args: JSON.stringify({
                  recipient: alice.accountId,
                }),
                gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
                attached_amount: "5",
              },
            },
            {
              MallocCall: {
                contract_id: MALLOC_CALL_SEND_CONTRACT_ID,
                json_args: JSON.stringify({
                  recipient: bob.accountId,
                }),
                gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
                attached_amount: "5",
              },
            },
          ],
          ft_contract_id: TestingUtils.WRAP_TESTNET_CONTRACT,
        },
      ],
      [[[], []]],
      amount.toString(),
      { gas: MAX_GAS, depositTransactionHash }
    );
    const ret = await malloc.resolveTransactions(txRess);
    expect(ret.flag).toBe(TransactionWithPromiseResultFlag.SUCCESS);

    const newaliceBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      alice.accountId,
      wrappedTesterAccount
    );
    const newbobBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      bob.accountId,
      wrappedTesterAccount
    );
    const newmyBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount
    );
    TestingUtils.checkBalDifferences(aliceBal, newaliceBal, 450, expect);
    TestingUtils.checkBalDifferences(bobBal, newbobBal, 150, expect);
    TestingUtils.checkBalDifferences(myBal, newmyBal, -600, expect);
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(masterAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
