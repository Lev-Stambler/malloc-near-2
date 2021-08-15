import * as MallocClient from "../lib/malloc-client";
import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import {
  SpecialAccountType,
  SpecialAccountWithKeyPair,
} from "../lib/interfaces";

let malloc: MallocClient.MallocClient<SpecialAccountWithKeyPair>;
const TOKEN_ACCOUNT_IDS = [
  TestingUtils.WRAP_TESTNET_CONTRACT,
  "ndai.ft-fin.testnet",
];
let wrappedAccount: MallocClient.SpecialAccountWithKeyPair;

describe("malloc-client's ft capabilities", () => {
  jest.setTimeout(30 * 1000);
  beforeAll(async () => {
    const account = await TestingUtils.getDefaultTesterAccountNear();
    wrappedAccount = MallocClient.wrapAccountKeyPair(
      account,
      TestingUtils.getDefaultTesterKeypair()
    ) as MallocClient.SpecialAccountWithKeyPair;
    malloc = new MallocClient.MallocClient(
      wrappedAccount,
      TestingUtils.getMallocContract()
    );
  });

  // TODO: test w/ the multiple account ids

  it("should register an accountId with the given fungible tokens with one tx call, then ensure that the tokens are not reregistered", async () => {
    const bob = await TestingUtils.newRandAccount(wrappedAccount);
    const alice = await TestingUtils.newRandAccount(wrappedAccount);
    const { txs, contractsToRegisterWith } = await malloc.registerAccountDeposits(
      TOKEN_ACCOUNT_IDS,
      [bob.accountId],
      {
        executeTransactions: true,
      }
    );
    const tokensRegistered = contractsToRegisterWith
    console.log(tokensRegistered);
    expect(tokensRegistered.sort()).toEqual(TOKEN_ACCOUNT_IDS.sort());
    for (let i = 0; i < tokensRegistered.length; i++) {
      expect(
        await TestingUtils.isFtRegistered(
          tokensRegistered[i],
          bob.accountId,
          wrappedAccount
        )
      ).toBeTruthy();
    }
    const newTokensRegistered = await malloc.registerAccountDeposits(
      TOKEN_ACCOUNT_IDS,
      [bob.accountId]
    );
    expect(newTokensRegistered).toEqual([]);
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(wrappedAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
