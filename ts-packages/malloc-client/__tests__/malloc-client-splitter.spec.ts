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
const TOKEN_ACCOUNT_IDS = ["wrap.testnet", "ndai.ft-fin.testnet"];
let wrappedAccount: MallocClient.SpecialAccountWithKeyPair;

describe("malloc-client's ft capabilities", () => {
  jest.setTimeout(30 * 1000);
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

  xit("should send Wrapped Near using the SimpleTransferWcall", async () => {
    const WCALL_SEND_CONTRACT_ID = TestingUtils.getWcallSendContract();

    const amount = 600;
    const alice = await TestingUtils.newRandAccount(wrappedAccount);
    const bob = await TestingUtils.newRandAccount(wrappedAccount);

    await TestingUtils.setupWNearAccount(
      "wrap.testnet",
      wrappedAccount.accountId,
      wrappedAccount,
      true,
      amount + 20
    );

    // Hmmmm, should the malloc client somehow do this for the user?
    await TestingUtils.setupWNearAccount(
      "wrap.testnet",
      alice.accountId,
      alice
    );
    await TestingUtils.setupWNearAccount("wrap.testnet", bob.accountId, bob);
    await TestingUtils.setupWNearAccount(
      "wrap.testnet",
      malloc.contractAccountId,
      wrappedAccount
    );
    await TestingUtils.setupWNearAccount(
      "wrap.testnet",
      WCALL_SEND_CONTRACT_ID,
      wrappedAccount
    );

    // Ideally this is handled by malloc-client
    // await wrappedAccount.functionCall({
    //   contractId: "wrap.testnet",
    //   methodName: "ft_transfer",
    //   args: {
    //     receiver_id: malloc.contractAccountId,
    //     amount: amount.toString(),
    //     msg: "",
    //     memo: "",
    //   },
    //   attachedDeposit: new BN(1),
    //   gas: TestingUtils.MAX_GAS,
    // });

    // TODO: maybe have attached deposit be auto calculated!
    // Including for the subcalls and they get added in via malloc client
    // TODO: maybe have the gas be auto calculated!
    // subcalls add stuff back in
    await malloc.runEphemeralSplitter(
      {
        splits: [3, 1],
        nodes: [
          {
            WCall: {
              contract_id: WCALL_SEND_CONTRACT_ID,
              json_args: JSON.stringify({
                recipient: bob.accountId,
              }),
              gas: WCALL_SIMPLE_GAS.toNumber(),
              attached_deposit: 10,
            },
          },
          {
            WCall: {
              contract_id: WCALL_SEND_CONTRACT_ID,
              json_args: JSON.stringify({
                recipient: bob.accountId,
              }),
              gas: WCALL_SIMPLE_GAS.toNumber(),
              attached_deposit: 10,
            },
          },
        ],
        ft_contract_id: "wrap.testnet",
      },
      amount.toString(),
      { gas: MAX_GAS }
    );
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(wrappedAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
