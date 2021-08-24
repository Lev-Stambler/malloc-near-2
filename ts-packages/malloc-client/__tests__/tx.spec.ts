import { utils } from "near-api-js";
import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import {
  SpecialAccount,
  SpecialAccountType,
  SpecialAccountWithKeyPair,
} from "../lib/interfaces";
import { MallocClient, wrapAccountKeyPair } from "../lib/malloc-client";
import { executeMultipleTx, executeMultipleTxNoDeposit } from "../lib/tx";

const TOKEN_ACCOUNT_IDS = [TestingUtils.WRAP_TESTNET_CONTRACT];
let malloc: MallocClient<SpecialAccountWithKeyPair>;

describe("test transaction utils", () => {
  jest.setTimeout(30 * 1000);
  let wrappedAccount: SpecialAccount;

  beforeAll(async () => {
    const account = await TestingUtils.getDefaultTesterAccountNear();
    wrappedAccount = wrapAccountKeyPair(
      account,
      TestingUtils.getDefaultTesterKeypair()
    );
    malloc = new MallocClient(
      wrappedAccount,
      TestingUtils.getMallocContract(),
      {
        executeTxsByDefault: true,
      }
    );
  });

  // TODO: test w/ the multiple account ids
  it("should run multiple txs with a special wallets", async () => {
    // test depositing wrap near
    const alice = await TestingUtils.newRandAccount(wrappedAccount);
    const NEW_ACCOUNT_STORAGE_COST = utils.format.parseNearAmount("0.00125");
    await executeMultipleTx(alice, [
      {
        receiverId: TestingUtils.WRAP_TESTNET_CONTRACT,
        functionCalls: [
          {
            methodName: "storage_deposit",
            amount: NEW_ACCOUNT_STORAGE_COST,
          },
        ],
      },
    ]);
    const storageBal = await alice.viewFunction(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      "storage_balance_of",
      {
        account_id: alice.accountId,
      }
    );
    expect(storageBal.total).toEqual(NEW_ACCOUNT_STORAGE_COST);
  });

  it("should register an accountId with the given fungible tokens with one tx call, then ensure that the tokens are not reregistered", async () => {
    const bob = await TestingUtils.newRandAccount(wrappedAccount);
    const alice = await TestingUtils.newRandAccount(wrappedAccount);
    const { contractsToRegisterWith: tokensRegistered } =
      await malloc.registerAccountDeposits(TOKEN_ACCOUNT_IDS, [bob.accountId], {
        executeTransactions: true,
      });
    expect(tokensRegistered).toEqual(TOKEN_ACCOUNT_IDS);
    for (let i = 0; i < tokensRegistered.length; i++) {
      expect(
        await TestingUtils.isFtRegistered(
          tokensRegistered[i],
          bob.accountId,
          wrappedAccount
        )
      ).toBeTruthy();
    }
    const { contractsToRegisterWith: newTokensRegistered } =
      await malloc.registerAccountDeposits(TOKEN_ACCOUNT_IDS, [bob.accountId], {
        executeTransactions: true,
      });
    expect(newTokensRegistered).toEqual([]);
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(wrappedAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
