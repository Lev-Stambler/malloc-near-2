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

let malloc: MallocClient.MallocClient<MallocClient.SpecialAccountWithKeyPair>;
const TOKEN_ACCOUNT_IDS = [
  TestingUtils.WRAP_TESTNET_CONTRACT,
  "ndai.ft-fin.testnet",
];
let wrappedAccount: MallocClient.SpecialAccountWithKeyPair;

describe("malloc-client's ft capabilities", () => {
  jest.setTimeout(60 * 1000);
  beforeAll(async () => {
    const account = await TestingUtils.getDefaultTesterAccountNear();
    wrappedAccount = MallocClient.wrapAccount(
      account,
      SpecialAccountType.KeyPair,
      TestingUtils.getDefaultTesterKeypair()
    ) as MallocClient.SpecialAccountWithKeyPair;
    malloc = await MallocClient.createMallocClient(
      wrappedAccount,
      TestingUtils.getMallocContract()
    );
  });

  it("should send native tokens to 3 separate user accounts", async () => {
    const alice = await TestingUtils.newRandAccount(wrappedAccount);
    const aliceBal = (await alice.getAccountBalance()).total;

    const bob = await TestingUtils.newRandAccount(wrappedAccount);
    const bobBal = (await bob.getAccountBalance()).total;

    const karen = await TestingUtils.newRandAccount(wrappedAccount);
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

  it("should send send Native Near, Wrapped Near with a malloc call, and wrapped near with a native call", async () => {
    const amount = 600;
    const alice = await TestingUtils.newRandAccount(wrappedAccount);
    const bob = await TestingUtils.newRandAccount(wrappedAccount);
    const karen = await TestingUtils.newRandAccount(wrappedAccount);

    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedAccount.accountId,
      wrappedAccount,
      true,
      amount + 20
    );
    const txs = await await malloc.registerAccountWithFungibleToken(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        alice.accountId,
        bob.accountId,
        karen.accountId,
        wrappedAccount.accountId,
        malloc.contractAccountId,
      ]
    );
    const aliceBal = await (await alice.getAccountBalance()).total;
    const karenBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      karen.accountId,
      wrappedAccount
    );
    const bobBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      bob.accountId,
      wrappedAccount
    );
    const myBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedAccount.accountId,
      wrappedAccount
    );
    const txRess = await malloc.runEphemeralSplitter(
      {
        splits: [1, 2, 3],
        nodes: [
          {
            SimpleTransfer: {
              recipient: alice.accountId,
            },
            FTTransfer: {
              recipient: bob.accountId,
            },
          },
          {
            FTTransfer: {
              recipient: karen.accountId,
            },
          },
        ],
        ft_contract_id: TestingUtils.WRAP_TESTNET_CONTRACT,
      },
      amount.toString(),
      { gas: MAX_GAS }
    );
    console.log(txRess);
    const ret = await malloc.resolveTransactions(txRess);
    expect(ret.flag).toBe(TransactionWithPromiseResultFlag.SUCCESS);

    const newaliceBal = await (await alice.getAccountBalance()).total;
    const newbobBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      bob.accountId,
      wrappedAccount
    );
    const newmyBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedAccount.accountId,
      wrappedAccount
    );
    const newkarenBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      karen.accountId,
      wrappedAccount
    );
    TestingUtils.checkBalDifferences(aliceBal, newaliceBal, 100, expect);
    TestingUtils.checkBalDifferences(bobBal, newbobBal, 200, expect);
    TestingUtils.checkBalDifferences(karenBal, newkarenBal, 300, expect);
    TestingUtils.checkBalDifferences(myBal, newmyBal, -600, expect);
  });

  it("should send Wrapped Near using the native transfer", async () => {
    const amount = 600;
    const alice = await TestingUtils.newRandAccount(wrappedAccount);
    const bob = await TestingUtils.newRandAccount(wrappedAccount);

    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedAccount.accountId,
      wrappedAccount,
      true,
      amount + 20
    );
    const txs = await await malloc.registerAccountWithFungibleToken(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        alice.accountId,
        bob.accountId,
        wrappedAccount.accountId,
        malloc.contractAccountId,
      ]
    );
    const aliceBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      alice.accountId,
      wrappedAccount
    );
    const bobBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      bob.accountId,
      wrappedAccount
    );
    const myBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedAccount.accountId,
      wrappedAccount
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
      { gas: MAX_GAS }
    );
    console.log(txRess);
    const ret = await malloc.resolveTransactions(txRess);
    expect(ret.flag).toBe(TransactionWithPromiseResultFlag.SUCCESS);

    const newaliceBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      alice.accountId,
      wrappedAccount
    );
    const newbobBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      bob.accountId,
      wrappedAccount
    );
    const newmyBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedAccount.accountId,
      wrappedAccount
    );
    TestingUtils.checkBalDifferences(aliceBal, newaliceBal, 450, expect);
    TestingUtils.checkBalDifferences(bobBal, newbobBal, 150, expect);
    TestingUtils.checkBalDifferences(myBal, newmyBal, -600, expect);
  });

  it.only("should send Wrapped Near using the SimpleTransferWcall", async () => {
    const WCALL_SEND_CONTRACT_ID = TestingUtils.getWcallSendContract();

    const amount = 600;
    const alice = await TestingUtils.newRandAccount(wrappedAccount);
    const bob = await TestingUtils.newRandAccount(wrappedAccount);

    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedAccount.accountId,
      wrappedAccount,
      true,
      amount + 20
    );
    await malloc.registerAccountWithFungibleToken(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        alice.accountId,
        bob.accountId,
        wrappedAccount.accountId,
        malloc.contractAccountId,
        WCALL_SEND_CONTRACT_ID,
      ]
    );
    const aliceBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      alice.accountId,
      wrappedAccount
    );
    const bobBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      bob.accountId,
      wrappedAccount
    );
    const myBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedAccount.accountId,
      wrappedAccount
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
      { gas: MAX_GAS }
    );
    console.log(txRess);
    const ret = await malloc.resolveTransactions(txRess);
    expect(ret.flag).toBe(TransactionWithPromiseResultFlag.SUCCESS);

    const newaliceBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      alice.accountId,
      wrappedAccount
    );
    const newbobBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      bob.accountId,
      wrappedAccount
    );
    const newmyBal = await TestingUtils.ftBalOf(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedAccount.accountId,
      wrappedAccount
    );
    TestingUtils.checkBalDifferences(aliceBal, newaliceBal, 450, expect);
    TestingUtils.checkBalDifferences(bobBal, newbobBal, 150, expect);
    TestingUtils.checkBalDifferences(myBal, newmyBal, -600, expect);
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(wrappedAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
