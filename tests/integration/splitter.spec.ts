import { readFileSync } from "fs";
import * as NearAPI from "near-api-js";
import bs58 from "bs58";
import { InMemoryKeyStore } from "near-api-js/lib/key_stores";
import { KeyPair, KeyPairEd25519 } from "near-api-js/lib/utils";
import "regenerator-runtime/runtime";
import type { MallocContract } from "../../src/types";
import BASIC_FT from "../__mocks__/basic-ft.json";
import tester from "./tester-malloc2.levtester.testnet.json";

import "near-cli/test_environment";
let near: NearAPI.Near;
let contract: MallocContract;
let contractName: string;
let accountId: string;

jest.setTimeout(30000);

const setup = async () => {
  const createFakeStorage = () => {
    let store = {};
    return {
      getItem: function (key) {
        return store[key];
      },
      setItem: function (key, value) {
        store[key] = value.toString();
      },
      clear: function () {
        store = {};
      },
      removeItem: function (key) {
        delete store[key];
      },
    };
  };
  const contractName = readFileSync("neardev/dev-account").toString();
  accountId = tester.account_id;
  const keyStore = new NearAPI.keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(tester.private_key);
  await keyStore.setKey("testnet", tester.account_id, keyPair);

  const near = await NearAPI.connect({
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
    masterAccount: tester.account_id,
    keyPath: `${__dirname}/tester-malloc2.levtester.testnet.json`,
    keyStore: keyStore,
  });
  return { near, contractName };
};

beforeAll(async () => {
  const { near: _near, contractName: _contractName } = await setup();
  near = _near;
  contractName = _contractName;
  contract = new NearAPI.Contract(
    await near.account(tester.account_id),
    contractName,
    {
      changeMethods: ["run_ephemeral"],
      viewMethods: [],
    }
  ) as MallocContract;
});

it("send one message and retrieve it", async () => {
  const ret = await contract.run_ephemeral({
    splitter: {
      owner: "levtester.testnet",
      split_sum: 100,
      splits: [100],
      nodes: [
        {
          FTTransfer: {
            recipient: "lev.testnet",
          },
        },
      ],
      ft_contract_id: "wrap.testnet",
    },
  });
  console.log(ret)
});
