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

xdescribe("malloc-client's error handling", () => {
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

  xit("should fail because the construction is not found (this happens by deleting a construction midway through a call)", async () => {});

  xit("should fail because a splitter is not found (this happens by deleting a splitter midway through a call)", async () => {});

  it("should fail to make the call because the number of splitters from one child to the next splitter set does not match", async () => {
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
    await malloc.registerAccountDeposits(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        wrappedTesterAccount.accountId,
        malloc.mallocAccountId,
        TestingUtils.getMallocCallPassthroughContract(),
      ],
      {
        executeTransactions: true,
      }
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

    const amount = 0;

    console.log("Account ID", wrappedTesterAccount.accountId);
    try {
      await malloc.runEphemeralConstruction(
        [
          {
            splits: [1],
            children: [
              {
                MallocCall: {
                  contract_id: TestingUtils.getMallocCallPassthroughContract(),

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
                  contract_id: TestingUtils.getMallocCallErrorContract(),

                  json_args: JSON.stringify({
                    log_message: "hello an error for alice level 2",
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
        [[[1]], [[2]], [[]]],
        amount.toString(),
        { gas: MAX_GAS }
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
      expect(callData.splitter_calls.length).toEqual(2);
      expect(callData.next_splitter_call_stack.length).toEqual(0);
      expect(callData.splitter_calls[1].status.Error.message).toEqual(
        "The number of splitters for the next set of inputs does not match the call's return"
      );
    }
  });

  // TODO: this is fully wrong now
  xit("should revert an entire splitter's execution if one child fails", async () => {
    const amount = 150;
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
        TestingUtils.getMallocCallBlackwholeContract(),
        TestingUtils.getMallocCallErrorContract(),
      ]
    );
    console.log(
      "WRAP BAL DEPOSITED 1",
      await malloc.getTokenBalance(
        wrappedTesterAccount.accountId,
        TestingUtils.WRAP_TESTNET_CONTRACT
      )
    );

    const depositTransactionHash = await malloc.deposit(
      amount.toString(),
      TestingUtils.WRAP_TESTNET_CONTRACT
    );

    console.log("Account ID", wrappedTesterAccount.accountId);
    try {
      await malloc.runEphemeralConstruction(
        [
          {
            splits: [1, 1],
            children: [
              {
                MallocCall: {
                  contract_id: TestingUtils.getMallocCallBlackwholeContract(),

                  json_args: JSON.stringify({
                    log_message: "hello an error for alice level 1",
                  }),
                  gas: MALLOC_CALL_SIMPLE_GAS.toNumber(),
                  attached_amount: "0",
                },
              },
              {
                MallocCall: {
                  contract_id: TestingUtils.getMallocCallErrorContract(),

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
        ],
        [[[], []]],
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

      console.log(
        "WRAP BAL DEPOSITED",
        await malloc.getTokenBalance(
          wrappedTesterAccount.accountId,
          TestingUtils.WRAP_TESTNET_CONTRACT
        )
      );
    }
  });
});
