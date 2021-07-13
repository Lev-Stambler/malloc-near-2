import { Balances, runEphemeralTree } from "./test-framework";
import {
  addBigNumberish,
  allResultsSuccess,
  cleanUp,
  createNear,
  getContract,
  getFtContract,
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
import type {
  AccountId,
  MallocContract,
  SerializedSplitter,
} from "../../src/types";
import tester from "./tester-malloc2.levtester.testnet.json";
import { Account, Contract, providers, utils } from "near-api-js";

import "near-cli/test_environment";
import BN from "bn.js";
let near: NearAPI.Near;
let contract: MallocContract;
let wNearContract: Contract & any;
let contractName: string;

jest.setTimeout(60000);

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
  wNearContract = await getFtContract(
    await near.account(tester.account_id),
    "wrap.testnet"
  );
});

it("should send near to Alice and Bob", async () => {
  const amount = 150;
  const masterAccount = await near.account(tester.account_id);
  const alice = await newRandAccount(masterAccount);
  const bob = await newRandAccount(masterAccount);
  const splitter = {
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
          recipient: bob.accountId,
        },
      },
    ],
  };
  const expected: Balances = {};
  expected[bob.accountId] = {
    account: bob,
    bal: {
      nativeBal: addBigNumberish((await bob.getAccountBalance()).total, 50),
      ftBals: {},
    },
  };
  expected[alice.accountId] = {
    account: alice,
    bal: {
      nativeBal: addBigNumberish((await alice.getAccountBalance()).total, 100),
      ftBals: {},
    },
  };
  await runEphemeralTree(
    masterAccount,
    contractName,
    splitter,
    amount,
    amount,
    expected,
    near,
    expect
  );
});

it("should send wrapped near to Alice and Bob", async () => {
  const amount = 152;
  const masterAccount = await near.account(tester.account_id);
  const alice = await newRandAccount(masterAccount);
  const bob = await newRandAccount(masterAccount);

  await setupWNearAccount(
    wNearContract,
    tester.account_id,
    masterAccount,
    true,
    amount + 20
  );
  await setupWNearAccount(wNearContract, alice.accountId, alice);
  await setupWNearAccount(wNearContract, bob.accountId, bob);
  await setupWNearAccount(wNearContract, contractName, masterAccount);

  await masterAccount.functionCall({
    contractId: "wrap.testnet",
    methodName: "ft_transfer",
    args: {
      receiver_id: contractName,
      amount: amount.toString(),
      msg: "",
      memo: "",
    },
    attachedDeposit: new BN(1),
    gas: MAX_GAS,
  });

  const splitter = {
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
  };
  const expected: Balances = {};
  expected[bob.accountId] = {
    account: bob,
    bal: {
      ftBals: {
        "wrap.testnet": (0.75 * amount).toString(),
      },
    },
  };
  expected[alice.accountId] = {
    account: alice,
    bal: {
      ftBals: {
        "wrap.testnet": (0.25 * amount).toString(),
      },
    },
  };

  await runEphemeralTree(
    masterAccount,
    contractName,
    splitter,
    amount,
    3,
    expected,
    near,
    expect
  );
});

afterAll(async () => {
  await cleanUp(tester.account_id);
});

/*
Arguments: {
  "actions": [
    {
      "pool_id": 20,
      "token_in": "wrap.testnet",
      "token_out": "ndai.ft-fin.testnet",
      "amount_in": "1000000000000000000000000",
      "min_amount_out": "91479657"
    }
  ]
}
Swap from wNEAR to nDAI, then test with nDAI to nUSDC?
*/
