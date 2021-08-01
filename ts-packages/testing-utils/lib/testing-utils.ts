import BN from "bn.js";
import { readFileSync } from "fs";
import {
  Account,
  connect,
  Contract,
  KeyPair,
  keyStores,
  Near,
  providers,
  utils,
} from "near-api-js";
import { KeyPairEd25519, PublicKey } from "near-api-js/lib/utils";
import { join } from "path";
import {
  AccountId,
  BigNumberish,
  SpecialAccount,
  SpecialAccountType,
  SpecialAccountWithKeyPair,
} from "../../malloc-client/lib/interfaces";
import { wrapAccount } from "../../malloc-client/lib/malloc-client";
import tester from "./tester.json";

let generatedAccounts: Account[] = [];
export const rpcNode = "https://rpc.testnet.near.org";
export const MAX_GAS = new BN("300000000000000");
const NEW_ACCOUNT_STORAGE_COST = utils.format.parseNearAmount("0.00125");
export const WCALL_SIMPLE_GAS = new BN("15000000000000");
export const provider = new providers.JsonRpcProvider(rpcNode);
export const WRAP_TESTNET_CONTRACT = "wrap.testnet";

interface CreateConnectionOpts {
  privateKey?: string;
  keyPair?: KeyPair;
  accountId: string;
}

export const getWcallSendContract = () =>
  readFileSync(
    join(
      __dirname,
      "../../../rust/packages/wcalls/send-wcall/neardev/dev-account"
    )
  ).toString();

export const getMallocContract = () =>
  readFileSync(
    join(__dirname, "../../../rust/packages/contract/neardev/dev-account")
  ).toString();

export const getDefaultTesterAccountNear = async (): Promise<Account> => {
  const near = await createNear({
    privateKey: tester.private_key,
    accountId: tester.account_id,
  });
  return await near.account(tester.account_id);
};

export const getDefaultTesterKeypair = (): KeyPair =>
  KeyPair.fromString(tester.private_key);

export const createNear = async (opts: CreateConnectionOpts): Promise<Near> => {
  const keyStore = new keyStores.InMemoryKeyStore();
  const _keyPair =
    opts.keyPair ?? opts.privateKey
      ? KeyPair.fromString(opts.privateKey as string)
      : null;
  if (!_keyPair) throw "Either a key pair or a private key has to be passed in";
  await keyStore.setKey("testnet", opts.accountId, _keyPair);

  const near = await connect({
    networkId: "testnet",
    nodeUrl: rpcNode,
    masterAccount: opts.accountId,
    keyPath: `${__dirname}/tester-malloc2.levtester.testnet.json`,
    keyStore: keyStore,
  });
  return near;
};

export const getFtContract = async (
  caller: Account,
  contractId: string
): Promise<Contract> => {
  return new Contract(caller, contractId, {
    changeMethods: ["near_deposit", "storage_deposit", "ft_transfer_call"],
    viewMethods: ["ft_balance_of", "storage_balance_of"],
  });
};

export const ftBalOf = async (
  ftContractId: AccountId,
  accountId: AccountId,
  caller: Account
): Promise<string> => {
  const bal = await caller.viewFunction(ftContractId, "ft_balance_of", {
    account_id: accountId,
  });
  return bal;
};

export const isFtRegistered = async (
  contractAddr: string,
  accountId: string,
  caller: Account
) => {
  const storageBal = await caller.viewFunction(
    contractAddr,
    "storage_balance_of",
    {
      account_id: accountId,
    }
  );
  return storageBal && storageBal.total !== "0";
};

export const setupFT = async (
  contractAddr: string,
  accountId: string,
  caller: Account
) => {
  if (!(await isFtRegistered(contractAddr, accountId, caller)))
    await caller.functionCall({
      contractId: contractAddr,
      methodName: "storage_deposit",
      args: { account_id: accountId },
      attachedDeposit: new BN(NEW_ACCOUNT_STORAGE_COST as string),
      gas: MAX_GAS,
    });
};

export const setupWNearAccount = async (
  contractAddr: string,
  accountId: string,
  caller: Account,
  initDeposit = false,
  amountInitDeposit: number | string = 10000
) => {
  await setupFT(contractAddr, accountId, caller);
  if (initDeposit) {
    const wNearbal = await caller.viewFunction(contractAddr, "ft_balance_of", {
      account_id: accountId,
    });
    console.info("Current wNear balance of", wNearbal);
    if (wNearbal < amountInitDeposit)
      await caller.functionCall({
        contractId: contractAddr,
        methodName: "near_deposit",
        args: {},
        gas: MAX_GAS,
        attachedDeposit: new BN(amountInitDeposit).sub(new BN(wNearbal)),
      });
  }
};

export const newRandAccount = async (
  masterAccount?: Account
): Promise<SpecialAccountWithKeyPair> => {
  let _masterAccount = masterAccount ?? (await getDefaultTesterAccountNear());
  const randName = Math.random();
  // remove the 0.
  const newAccountId = `${randName.toString().substr(2)}.${
    _masterAccount.accountId
  }`;
  const kp = KeyPairEd25519.fromRandom();
  await _masterAccount.createAccount(
    newAccountId,
    kp.getPublicKey(),
    new BN(utils.format.parseNearAmount("0.8") as string)
  );
  const near = await createNear({
    accountId: newAccountId,
    privateKey: kp.secretKey,
  });
  const account = await near.account(newAccountId);
  console.log("Created account", newAccountId);
  generatedAccounts.push(account);
  return wrapAccount(
    account,
    SpecialAccountType.KeyPair,
    kp
  ) as SpecialAccountWithKeyPair;
};

export const getResults = async (txHash: string, accountId: string) => {
  const res = await provider.txStatusReceipts(
    new Uint8Array(utils.serialize.base_decode(txHash)),
    accountId
  );
  return res.receipts_outcome.map((outcome) => outcome.outcome.status);
};

export const allResultsSuccess = (results: any[]) =>
  results.every(
    (result) =>
      result["SuccessValue"] === "" ||
      result["SuccessValue"] ||
      result["SuccessReceiptId"] === "" ||
      result["SuccessReceiptId"]
  );

// TODO: remove storage deposit from tokenAccountIds
// TODO: convert balances of token accounts to wNear, then convert that back to Near and give to OG account
export const cleanUp = async (
  beneficiaryId: string,
  tokenAccountIds: AccountId[]
) => {
  console.log(
    "Deleteing the following accounts",
    generatedAccounts.map((account) => account.accountId)
  );
  try {
    await Promise.all(
      generatedAccounts.map((account) => account.deleteAccount(beneficiaryId))
    );
  } catch (e) {}
  generatedAccounts = []
};

export const addBigNumberish = (
  a: string | BN | number,
  b: string | BN | number
): string => {
  return new BN(a).add(new BN(b)).toString();
};

export const checkBalDifferences = (
  oldBal: BigNumberish,
  newBal: BigNumberish,
  expectedDiff: number,
  expect: any
) => {
  expect(new BN(newBal).toString()).toBe(
    new BN(oldBal).addn(expectedDiff).toString()
  );
};
