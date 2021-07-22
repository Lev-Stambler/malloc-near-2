import * as MallocClient from "../lib/malloc-client";
import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import { SpecialAccountType } from "../lib/interfaces";

let malloc: MallocClient.MallocClient;
const TOKEN_ACCOUNT_IDS = ["wrap.testnet", "ndai.ft-fin.testnet"];
let wrappedAccount: MallocClient.SpecialAccountWithKeyPair;

describe("malloc-client's ft capabilities", () => {
  jest.setTimeout(30 * 1000)
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

  // TODO: test w/ the multiple account ids

  it("should register an accountId with the given fungible tokens with one tx call, then ensure that the tokens are not reregistered", async () => {
    const bob = await TestingUtils.newRandAccount(wrappedAccount);
    const alice = await TestingUtils.newRandAccount(wrappedAccount);
    const tokensRegistered = await malloc.registerAccountWithFungibleToken(
      TOKEN_ACCOUNT_IDS,
      [bob.accountId]
    );
    console.log(tokensRegistered)
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
    const newTokensRegistered = await malloc.registerAccountWithFungibleToken(
      TOKEN_ACCOUNT_IDS,
      [bob.accountId]
    );
    expect(newTokensRegistered).toEqual([]);
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(wrappedAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
