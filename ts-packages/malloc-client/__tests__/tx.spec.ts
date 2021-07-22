import { utils } from "near-api-js";
import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import { SpecialAccount, SpecialAccountType } from "../lib/interfaces";
import { wrapAccount } from "../lib/malloc-client";
import { executeMultipleTx } from "../lib/tx";

const TOKEN_ACCOUNT_IDS = ["wrap.testnet"];

describe("test transaction utils", () => {
  jest.setTimeout(30 * 1000);
  let wrappedAccount: SpecialAccount;

  beforeAll(async () => {
    const account = await TestingUtils.getDefaultTesterAccountNear();
    wrappedAccount = wrapAccount(
      account,
      SpecialAccountType.KeyPair,
      TestingUtils.getDefaultTesterKeypair()
    );
  });

  // TODO: test w/ the multiple account ids
  it("should run multiple txs with a special wallets", async () => {
    // test depositing wrap near
    const alice = await TestingUtils.newRandAccount(wrappedAccount);
    const NEW_ACCOUNT_STORAGE_COST = utils.format.parseNearAmount("0.00125");
    await executeMultipleTx(alice, [
      {
        receiverId: "wrap.testnet",
        functionCalls: [
          {
            methodName: "storage_deposit",
            amount: NEW_ACCOUNT_STORAGE_COST,
          },
        ],
      },
    ]);
    const storageBal = await alice.viewFunction(
      "wrap.testnet",
      "storage_balance_of",
      {
        account_id: alice.accountId,
      }
    );
    expect(storageBal.total).toEqual(NEW_ACCOUNT_STORAGE_COST)
  });

  xit("should register an accountId with the given fungible tokens with one tx call, then ensure that the tokens are not reregistered", async () => {
    const bob = await TestingUtils.newRandAccount(wrappedAccount);
    const alice = await TestingUtils.newRandAccount(wrappedAccount);
    const tokensRegistered = await malloc.registerAccountWithFungibleToken(
      TOKEN_ACCOUNT_IDS,
      [bob.accountId]
    );
    expect(tokensRegistered).toBe(TOKEN_ACCOUNT_IDS);
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
    expect(newTokensRegistered).toBe([]);
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(wrappedAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
