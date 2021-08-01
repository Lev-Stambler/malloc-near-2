import * as MallocClient from "../lib/malloc-client";
import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import {
  SpecialAccountType,
  Splitter,
  TransactionWithPromiseResultFlag,
} from "../lib/interfaces";
import BN from "bn.js";
import { wrap } from "module";
import { MAX_GAS } from "../lib/tx";
import { WCALL_SIMPLE_GAS } from "../../testing-utils/lib/testing-utils";
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

  it("should send native tokens to 3 separate user accounts", async () => {
    const alice = await TestingUtils.newRandAccount(masterAccount);
    const aliceBal = (await alice.getAccountBalance()).total;

    const bob = await TestingUtils.newRandAccount(masterAccount);
    const bobBal = (await bob.getAccountBalance()).total;

    const karen = await TestingUtils.newRandAccount(masterAccount);
    const karenBal = (await karen.getAccountBalance()).total;

    const txHashes = await malloc.runEphemeralSplitter(
      {
        nodes: [
          { SimpleTransfer: { recipient: alice.accountId } },
          { SimpleTransfer: { recipient: karen.accountId } },
          { SimpleTransfer: { recipient: bob.accountId } },
        ],
        splits: [100, 200, 300],
      },
      "600",
      {
        gas: TestingUtils.MAX_GAS,
      }
    );
    const txResult = await malloc.resolveTransactions(txHashes);
    expect(txResult.flag).toBe(TransactionWithPromiseResultFlag.SUCCESS);
    expect((await alice.getAccountBalance()).total.toString()).toBe(
      new BN(aliceBal).addn(100).toString()
    );
    expect((await bob.getAccountBalance()).total.toString()).toBe(
      new BN(bobBal).addn(300).toString()
    );
    expect((await karen.getAccountBalance()).total.toString()).toBe(
      new BN(karenBal).addn(200).toString()
    );
  });

  it("should send send Native Near, Wrapped Near with a wrapped call, and wrapped near with a native call", async () => {
    const amount = 600;
    const alice = await TestingUtils.newRandAccount(masterAccount);
    const bob = await TestingUtils.newRandAccount(masterAccount);
    const karen = await TestingUtils.newRandAccount(masterAccount);

    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount,
      true,
      amount + 20
    );
    const txs = await await malloc.registerAccountWithFungibleToken(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        alice.accountId,
        bob.accountId,
        karen.accountId,
        wrappedTesterAccount.accountId,
        malloc.contractAccountId,
      ]
    );
    const aliceBal = await (await alice.getAccountBalance()).total;
    const karenBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      karen.accountId,
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

    // Only deposit 5/6th of the amount because part of it is native near
    const depositTransactionHash = await malloc.deposit(
      Math.ceil((amount * 5) / 6).toString(),
      TestingUtils.WRAP_TESTNET_CONTRACT
    );
    const WCALL_SEND_CONTRACT_ID = TestingUtils.getWcallSendContract();

    const txRess = await malloc.runEphemeralSplitter(
      {
        splits: [1, 2, 3],
        nodes: [
          {
            SimpleTransfer: {
              recipient: alice.accountId,
            },
          },
          {
            FTTransfer: {
              recipient: bob.accountId,
            },
          },
          {
            WCall: {
              contract_id: WCALL_SEND_CONTRACT_ID,
              json_args: JSON.stringify({
                recipient: bob.accountId,
              }),
              gas: WCALL_SIMPLE_GAS.toNumber(),
              attached_amount: "5",
            },
          },
        ],
        ft_contract_id: TestingUtils.WRAP_TESTNET_CONTRACT,
      },
      amount.toString(),
      { gas: MAX_GAS, depositTransactionHash }
    );
    console.log(txRess);
    const ret = await malloc.resolveTransactions(txRess);
    expect(ret.flag).toBe(TransactionWithPromiseResultFlag.SUCCESS);

    const newaliceBal = await (await alice.getAccountBalance()).total;
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
    const newkarenBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      karen.accountId,
      wrappedTesterAccount
    );
    TestingUtils.checkBalDifferences(aliceBal, newaliceBal, 100, expect);
    TestingUtils.checkBalDifferences(bobBal, newbobBal, 200, expect);
    TestingUtils.checkBalDifferences(karenBal, newkarenBal, 300, expect);
    TestingUtils.checkBalDifferences(myBal, newmyBal, -600, expect);
  });

  it("should send Wrapped Near using the native transfer", async () => {
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
    const txs = await await malloc.registerAccountWithFungibleToken(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        alice.accountId,
        bob.accountId,
        wrappedTesterAccount.accountId,
        malloc.contractAccountId,
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

    const txRess = await malloc.runEphemeralSplitter(
      {
        splits: [3, 1],
        nodes: [
          {
            FTTransfer: {
              recipient: alice.accountId,
            },
          },
          {
            FTTransfer: {
              recipient: bob.accountId,
            },
          },
        ],
        ft_contract_id: TestingUtils.WRAP_TESTNET_CONTRACT,
      },
      amount.toString(),
      { gas: MAX_GAS, depositTransactionHash }
    );
    console.log(txRess);
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

  it("should send Wrapped Near using the SimpleTransferWcall", async () => {
    const WCALL_SEND_CONTRACT_ID = TestingUtils.getWcallSendContract();

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
        WCALL_SEND_CONTRACT_ID,
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

    const txRess = await malloc.runEphemeralSplitter(
      {
        splits: [3, 1],
        nodes: [
          {
            WCall: {
              contract_id: WCALL_SEND_CONTRACT_ID,
              // TODO: no json stringify!!
              json_args: JSON.stringify({
                recipient: alice.accountId,
              }),
              gas: WCALL_SIMPLE_GAS.toNumber(),
              attached_amount: "5",
            },
          },
          {
            WCall: {
              contract_id: WCALL_SEND_CONTRACT_ID,
              json_args: JSON.stringify({
                recipient: bob.accountId,
              }),
              gas: WCALL_SIMPLE_GAS.toNumber(),
              attached_amount: "5",
            },
          },
        ],
        ft_contract_id: TestingUtils.WRAP_TESTNET_CONTRACT,
      },
      amount.toString(),
      { gas: MAX_GAS, depositTransactionHash }
    );
    const ret = await malloc.resolveTransactions(txRess);
    expect(ret.flag).toBe(TransactionWithPromiseResultFlag.SUCCESS);

    console.log("AAA", ret.flag);
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
    console.log("NEW BALS", newaliceBal, newbobBal, newmyBal);
    TestingUtils.checkBalDifferences(aliceBal, newaliceBal, 450, expect);
    TestingUtils.checkBalDifferences(bobBal, newbobBal, 150, expect);
    TestingUtils.checkBalDifferences(myBal, newmyBal, -600, expect);
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(masterAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
