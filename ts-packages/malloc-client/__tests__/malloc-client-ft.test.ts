import "regenerator-runtime/runtime";

import * as MallocClient from "../lib/malloc-client";
import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import { SpecialAccountType } from "../lib/interfaces";

let malloc: MallocClient.MallocClient;
const TOKEN_ACCOUNT_IDS = ["wrap.testnet", "ndai.ft-fin.testnet"];
let wrappedAccount: MallocClient.SpecialAccountWithKeyPair;

describe("malloc-client's ft capabilities", () => {
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

  it("should register an accountId with the given fungible tokens with one tx call, then ensure that the tokens are not reregistered", async () => {
    const bob = await TestingUtils.newRandAccount(wrappedAccount);
    const tokensRegistered = await malloc.registerAccountWithFungibleToken(
      TOKEN_ACCOUNT_IDS,
      bob.accountId
    );
    expect(tokensRegistered).toBe(TOKEN_ACCOUNT_IDS);
    const newTokensRegistered = await malloc.registerAccountWithFungibleToken(
      TOKEN_ACCOUNT_IDS,
      bob.accountId
    );
    expect(newTokensRegistered).toBe([]);
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(wrappedAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
