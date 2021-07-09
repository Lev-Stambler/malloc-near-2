import { readFileSync } from "fs";
import {
  allResultsSuccess,
  cleanUp,
  createNear,
  getContract,
  getResults,
  MAX_GAS,
  newRandAccount,
  provider,
  setupWNearAccount,
} from "./shared";
import * as NearAPI from "near-api-js";
import bs58 from "bs58";
import { InMemoryKeyStore, KeyStore } from "near-api-js/lib/key_stores";
import { KeyPair, KeyPairEd25519, PublicKey } from "near-api-js/lib/utils";
import "regenerator-runtime/runtime";
import type { AccountId, MallocContract } from "../../src/types";
import BASIC_FT from "../__mocks__/basic-ft.json";
import tester from "./tester-malloc2.levtester.testnet.json";
import { Account, Contract, providers, utils } from "near-api-js";

import "near-cli/test_environment";
import BN from "bn.js";
let near: NearAPI.Near;
let contract: MallocContract;
let wNearContract: Contract & any;
let contractName: string;

jest.setTimeout(30000);

beforeAll(async () => {
  near = await createNear({
    privateKey: tester.private_key,
    accountId: tester.account_id,
  });
  contractName = getContract();
  contract = new NearAPI.Contract(
    await near.account(tester.account_id),
    contractName,
    {
      changeMethods: ["run_ephemeral"],
      viewMethods: [],
    }
  ) as MallocContract;
  wNearContract = new NearAPI.Contract(
    await near.account(tester.account_id),
    "wrap.testnet",
    {
      changeMethods: ["near_deposit", "storage_deposit", "ft_transfer_call"],
      viewMethods: ["ft_balance_of", "storage_balance_of"],
    }
  );
});

it("should send near to Alice and Bob", async () => {
  const amount = 150;
  const masterAccount = await near.account(tester.account_id);
  const alice = await newRandAccount(masterAccount);
  const priorBal = await alice.getAccountBalance();
  const ret = await masterAccount.functionCall({
    contractId: contractName,
    methodName: "run_ephemeral",
    args: {
      splitter: {
        owner: "levtester.testnet",
        split_sum: 150,
        splits: [100, 50],
        nodes: [
          {
            SimpleTransfer: {
              recipient: alice.accountId,
            },
          },
          {
            SimpleTransfer: {
              recipient: "lev.testnet",
            },
          },
        ],
      },
    },
    gas: MAX_GAS,
    attachedDeposit: new BN(amount),
  });
  const results = await getResults(
    ret.transaction.hash as string,
    tester.account_id
  );
  expect(allResultsSuccess(results)).toBeTruthy();
  const newBal = await alice.getAccountBalance();
  expect(new BN(newBal.total).sub(new BN(priorBal.total)).toNumber()).toEqual(
    100
  );
});

it.only("should send wrapped near to Alice and Bob", async () => {
  const amount = 152;
  const masterAccount = await near.account(tester.account_id);
  const alice = await newRandAccount(masterAccount);
  const bob = await newRandAccount(masterAccount);

  await setupWNearAccount(
    wNearContract,
    tester.account_id,
    masterAccount,
    true,
    amount
  );
  await setupWNearAccount(wNearContract, alice.accountId, alice);
  await setupWNearAccount(wNearContract, bob.accountId, bob);
  await setupWNearAccount(wNearContract, contractName, masterAccount);

  const transferContractRet = await masterAccount.functionCall({
    contractId: "wrap.testnet",
    methodName: "ft_transfer_call",
    args: {
      receiver_id: contractName,
      amount: (amount).toString(),
      msg: "",
      memo: "",
    },
    gas: MAX_GAS,
    attachedDeposit: new BN(1),
  });
  await getResults(
    transferContractRet.transaction.hash as string,
    tester.account_id
  );
  const ret = await masterAccount.functionCall({
    contractId: contractName,
    methodName: "run_ephemeral",
    args: {
      splitter: {
        owner: "levtester.testnet",
        split_sum: 4,
        splits: [3, 1],
        nodes: [
          {
            FTTransfer: {
              recipient: bob.accountId,
            },
          },
          {
            FTTransfer: {
              recipient: alice.accountId,
            },
          },
        ],
        ft_contract_id: "wrap.testnet",
      },
      amount,
    },
    gas: MAX_GAS,
    attachedDeposit: new BN(amount),
  });
  const results = await getResults(ret.transaction.hash, tester.account_id);
  expect(allResultsSuccess(results)).toBeTruthy();

  const bobBal = wNearContract.ft_balance_of({account_id: bob.accountId})
  expect(bobBal).toEqual(0.75 * amount)
  const aliceBal = wNearContract.ft_balance_of({account_id: alice.accountId})
  expect(aliceBal).toEqual(0.25 * amount)

});

afterAll(async () => {
  await cleanUp(tester.account_id);
});
