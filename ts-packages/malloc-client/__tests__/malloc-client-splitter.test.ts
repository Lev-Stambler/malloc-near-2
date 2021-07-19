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

  it("test a simple splitter flow for sending native tokens", async () => {
    const bob = await TestingUtils.newRandAccount(wrappedAccount);
    await malloc.runEphemeralSplitter({
      nodes: [],
      splits: [],

    })
  });

  afterAll(async () => {
    await TestingUtils.cleanUp(wrappedAccount.accountId, TOKEN_ACCOUNT_IDS);
  });
});
