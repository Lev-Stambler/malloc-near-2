import { Balances, runEphemeralTree } from "./test-framework";
import {
  addBigNumberish,
  cleanUp,
  createNear,
  getContract,
  MAX_GAS,
  newRandAccount,
  setupWNearAccount,
  WCALL_SIMPLE_GAS,
} from "./shared";
import * as NearAPI from "near-api-js";
import "regenerator-runtime/runtime";
import type {
  AccountId,
  MallocContract,
  SerializedSplitter,
} from "../../../ts-packages/malloc-frontend/src/types";
// TODO: change
import tester from "./tester-malloc2.levtester.testnet.json";

import "near-cli/test_environment";
import BN from "bn.js";
import { readFileSync } from "fs";
import { join } from "path";
let near: NearAPI.Near;
let contract: MallocContract;
let contractName: string;

const WCALL_SEND_CONTRACT_ID = readFileSync(
  join(__dirname, "../../packages/wcalls/send-wcall/neardev/dev-account")
).toString();

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
});

it("should send near to Alice and Bob", async () => {
  const amount = 150;
  const masterAccount = await near.account(tester.account_id);
  const alice = await newRandAccount(masterAccount);
  const bob = await newRandAccount(masterAccount);
  const splitter = {
    splits: [100, 50],
    actions: [
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

it.only("should send wrapped near to Alice and Bob via a Wcall", async () => {
  const amount = 152;
  const masterAccount = await near.account(tester.account_id);
  const alice = await newRandAccount(masterAccount);
  const bob = await newRandAccount(masterAccount);

  await setupWNearAccount(
    "wrap.testnet",
    tester.account_id,
    masterAccount,
    true,
    amount + 20
  );
  await setupWNearAccount("wrap.testnet", alice.accountId, alice);
  await setupWNearAccount("wrap.testnet", bob.accountId, bob);
  await setupWNearAccount("wrap.testnet", contractName, masterAccount);
  await setupWNearAccount("wrap.testnet", WCALL_SEND_CONTRACT_ID, masterAccount);

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

  const splitter: SerializedSplitter = {
    splits: [3, 1],
    actions: [
      {
        WCall: {
          contract_id: WCALL_SEND_CONTRACT_ID,
          json_args: JSON.stringify({
            recipient: bob.accountId,
          }),
          gas: WCALL_SIMPLE_GAS.toNumber(),
          attached_amount: 10,
        },
      },
      {
        WCall: {
          contract_id: WCALL_SEND_CONTRACT_ID,
          json_args: JSON.stringify({
            recipient: bob.accountId,
          }),
          gas: WCALL_SIMPLE_GAS.toNumber(),
          attached_amount: 10,
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
    30,
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
    "wrap.testnet",
    tester.account_id,
    masterAccount,
    true,
    amount + 20
  );
  await setupWNearAccount("wrap.testnet", alice.accountId, alice);
  await setupWNearAccount("wrap.testnet", bob.accountId, bob);
  await setupWNearAccount("wrap.testnet", contractName, masterAccount);

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
    splits: [3, 1],
    actions: [
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

// TODO: test if transfer fails, no one gets the funds (atomicity)
