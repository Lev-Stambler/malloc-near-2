import * as MallocClient from "../lib/malloc-client";
import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import {
  SpecialAccountType,
  SpecialAccountWithKeyPair,
} from "../lib/interfaces";
import BN from "bn.js";
import { Contract } from "near-api-js";

let malloc: MallocClient.MallocClient<SpecialAccountWithKeyPair>;
const TOKEN_ACCOUNT_IDS = [TestingUtils.WRAP_TESTNET_CONTRACT];
let wrappedAccount: MallocClient.SpecialAccountWithKeyPair;
let wrappedContract: Contract;

describe("malloc-client's ft capabilities", () => {
  jest.setTimeout(30 * 1000);
  beforeAll(async () => {
    const account = await TestingUtils.getDefaultTesterAccountNear();
    wrappedAccount = MallocClient.wrapAccount(
      account,
      SpecialAccountType.KeyPair,
      TestingUtils.getDefaultTesterKeypair()
    ) as MallocClient.SpecialAccountWithKeyPair;
    malloc = new MallocClient.MallocClient(
      wrappedAccount,
      TestingUtils.getMallocContract()
    );
    wrappedContract = await TestingUtils.getFtContract(
      wrappedAccount,
      TestingUtils.WRAP_TESTNET_CONTRACT
    );
  });

  // TODO: test w/ the multiple account ids

  it("should deposit wNear into the Malloc Contract", async () => {
    const amount = 100;
    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedAccount.accountId,
      wrappedAccount,
      true,
      amount + 20
    );
    const priorBalOnMallocRegistry = await malloc.getTokenBalance(
      wrappedAccount.accountId,
      TestingUtils.WRAP_TESTNET_CONTRACT
    );
    const priorBalOnWrapRegistry = await (wrappedContract as any).ft_balance_of(
      { account_id: malloc.mallocAccountId }
    );
    const tokensRegistered = await malloc.registerAccountWithFungibleToken(
      TOKEN_ACCOUNT_IDS,
      [malloc.mallocAccountId]
    );

    const tx = await malloc.deposit(amount.toString(), TestingUtils.WRAP_TESTNET_CONTRACT);

    const newBalOnWrapRegistry = await (wrappedContract as any).ft_balance_of({
      account_id: malloc.mallocAccountId,
    });
    const newBalOnMallocRegistry = await malloc.getTokenBalance(
      wrappedAccount.accountId,
      TestingUtils.WRAP_TESTNET_CONTRACT
    );

    TestingUtils.checkBalDifferences(
      priorBalOnMallocRegistry,
      newBalOnMallocRegistry,
      amount,
      expect
    );
    TestingUtils.checkBalDifferences(
      priorBalOnWrapRegistry,
      newBalOnWrapRegistry,
      amount,
      expect
    );
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(wrappedAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
