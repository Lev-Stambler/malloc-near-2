import * as MallocClient from "../lib/malloc-client";
import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import {
  CallEphemeralError,
  SpecialAccountType,
  Splitter,
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
    malloc = await MallocClient.createMallocClient(
      wrappedTesterAccount,
      TestingUtils.getMallocContract()
    );
  });

  xit("should fail because the construction is not found (this happens by deleting a construction midway through a call)", async () => {
  })

  xit("should fail because a splitter is not found (this happens by deleting a splitter midway through a call)", async () => {
  })

  it.only("should fail to make the call because the number of splitters from one child to the next splitter set does not match", async () => {
    const MALLOC_CALL_BLACKWHOLE_CONTRACT_ID =
      TestingUtils.getMallocCallBlackwholeContract();

    const amount = 100;

    console.log("Account ID", wrappedTesterAccount.accountId);
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
        malloc.contractAccountId,
        TestingUtils.getMallocCallPassthroughContract(),
      ]
    );

    const depositTransactionHash = await malloc.deposit(
      amount.toString(),
      TestingUtils.WRAP_TESTNET_CONTRACT
    );

    try {
      await malloc.runEphemeralConstruction(
        [
          {
            splits: [1],
            children: [
              {
                MallocCall: {
                  contract_id: TestingUtils.getMallocCallPassthroughContract(),
                  // TODO: no json stringify!!
                  json_args: JSON.stringify({
                    log_message: "hello an error for alice level 1",
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
                  // TODO: no json stringify!!
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
        [[[1, 2]], [[]]],
        amount.toString(),
        { gas: MAX_GAS, depositTransactionHash }
      );
      throw "Expected the call to fail";
    } catch (_e) {
      let e: CallEphemeralError = _e as any;
      console.log(e);
      expect(
        (e.message as string).includes(
          "The transaction's promises failed with a message"
        )
      ).toBeTruthy();
      const callData = await malloc.getConstructionCallData(
        e.constructionCallId
      );
      console.log(JSON.stringify(callData));
      expect(callData.splitter_calls.length).toEqual(1);
      expect(callData.next_splitter_call_stack.length).toEqual(0);
      expect(callData.splitter_calls[0].status.Error.message).toEqual(
        "The malloc call failed"
      );
    }
  });

  it("should make calls to a multi level splitter which fails on the first level of the splitter due to calling a call which panics. This failure should be logged", async () => {
    const MALLOC_CALL_BLACKWHOLE_CONTRACT_ID =
      TestingUtils.getMallocCallBlackwholeContract();

    const amount = 100;

    console.log("Account ID", wrappedTesterAccount.accountId);
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
        malloc.contractAccountId,
        TestingUtils.getMallocCallErrorContract(),
      ]
    );

    const depositTransactionHash = await malloc.deposit(
      amount.toString(),
      TestingUtils.WRAP_TESTNET_CONTRACT
    );

    try {
      await malloc.runEphemeralConstruction(
        [
          {
            splits: [1],
            children: [
              {
                MallocCall: {
                  contract_id: TestingUtils.getMallocCallErrorContract(),
                  // TODO: no json stringify!!
                  json_args: JSON.stringify({
                    log_message: "hello an error for alice level 1",
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
                  // TODO: no json stringify!!
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
        [[[1]], [[]]],
        amount.toString(),
        { gas: MAX_GAS, depositTransactionHash }
      );
      throw "Expected the call to fail";
    } catch (_e) {
      let e: CallEphemeralError = _e as any;
      console.log(e);
      expect(
        (e.message as string).includes(
          "The transaction's promises failed with a message"
        )
      ).toBeTruthy();
      const callData = await malloc.getConstructionCallData(
        e.constructionCallId
      );
      console.log(JSON.stringify(callData));
      expect(callData.splitter_calls.length).toEqual(1);
      expect(callData.next_splitter_call_stack.length).toEqual(0);
      expect(callData.splitter_calls[0].status.Error.message).toEqual(
        "The number of splitters for the next set of inputs does not match the call's return"
      );
    }
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
    await malloc.registerAccountWithFungibleToken(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        wrappedTesterAccount.accountId,
        malloc.contractAccountId,
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
                // TODO: no json stringify!!
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
                // TODO: no json stringify!!
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
                // TODO: no json stringify!!
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
                // TODO: no json stringify!!
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
                // TODO: no json stringify!!
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
      [[[1], [2], []], [[2], []], [[]]],
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

  it("should make a couple black whole calls and make sure that the most basic splitter succeeds", async () => {
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
        malloc.contractAccountId,
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
    await malloc.registerAccountWithFungibleToken(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        alice.accountId,
        bob.accountId,
        wrappedTesterAccount.accountId,
        malloc.contractAccountId,
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
                // TODO: no json stringify!!
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
