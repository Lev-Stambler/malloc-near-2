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
} from "../shared";
import * as NearAPI from "near-api-js";
import bs58 from "bs58";
import { InMemoryKeyStore, KeyStore } from "near-api-js/lib/key_stores";
import { KeyPair, KeyPairEd25519, PublicKey } from "near-api-js/lib/utils";
import "regenerator-runtime/runtime";
import tester from "../tester-malloc2.levtester.testnet.json";
import { Account, Contract, providers, utils } from "near-api-js";

import "near-cli/test_environment";
import BN from "bn.js";
import { readFileSync } from "fs";
import { join } from "path";
let near: NearAPI.Near;
let wNearContract: Contract & any;
let contractName: string;

jest.setTimeout(60000);

const REF_FINANCE_CONTRACT = "ref-finance.testnet";
const WNEAR_CONTRACT_ID = "wrap.testnet";
const NDAI_CONTRACT_ID = "ndai.ft-fin.testnet";

beforeAll(async () => {
  near = await createNear({
    privateKey: tester.private_key,
    accountId: tester.account_id,
  });
  // TODO: seperate folder/lib for getting/ storing the contract paths
  contractName = readFileSync(
    join(__dirname, "../../../wcalls/ref-swap-wcall/neardev/dev-account")
  ).toString();
  console.log("Got dev contract of", contractName);
  wNearContract = await getFtContract(
    await near.account(tester.account_id),
    WNEAR_CONTRACT_ID
  );
});

it("should swap wNEAR to DAI to USDC", async () => {
  const masterAccount = await near.account(tester.account_id);
  const amountWNear = "10000000000000000000";
  const amountWNearPlus1 = "10000000000000000001";
  await setupWNearAccount(
    wNearContract,
    tester.account_id,
    masterAccount,
    true,
    amountWNearPlus1
  );
  await setupWNearAccount(wNearContract, contractName, masterAccount);
  const tx = await masterAccount.functionCall({
    contractId: WNEAR_CONTRACT_ID,
    methodName: "ft_transfer",
    args: {
      receiver_id: contractName,
      amount: amountWNearPlus1,
      msg: "",
      memo: "",
    },
    attachedDeposit: new BN(1),
    gas: MAX_GAS,
  });
  // 	pub fn get_return(
  // 		&self,
  // 		pool_id: u64,
  // 		token_in: ValidAccountId,
  // 		amount_in: U128,
  // 		token_out: ValidAccountId,
  // ) -> U128 {
  // 		let pool = self.pools.get(pool_id).expect("ERR_NO_POOL");
  // 		pool.get_return(token_in.as_ref(), amount_in.into(), token_out.as_ref())
  // 				.into()
  // }
  const wNearToDAIPoolId = 20;
  const poolReturn = await masterAccount.viewFunction(
    REF_FINANCE_CONTRACT,
    "get_return",
    {
      pool_id: wNearToDAIPoolId,
      token_in: WNEAR_CONTRACT_ID,
      amount_in: amountWNear,
      token_out: NDAI_CONTRACT_ID,
    }
  );
  console.log("A pool return of", poolReturn);
  const minDaiRetrun = new BN(poolReturn).muln(90).divn(100);
  const wcallTx = await masterAccount.functionCall({
    methodName: "wcall",
    contractId: contractName,
    args: {
      args: {
        token_out: NDAI_CONTRACT_ID,
        pool_id: wNearToDAIPoolId,
        min_amount_out: minDaiRetrun.toString(),
        register_tokens: [NDAI_CONTRACT_ID, WNEAR_CONTRACT_ID],
      },
      recipient: tester.account_id,
      amount: amountWNear.toString(),
      token_contract: WNEAR_CONTRACT_ID,
    },
    attachedDeposit: new BN(3),
    gas: MAX_GAS,
  });
  const results = await getResults(wcallTx.transaction.hash, tester.account_id);
  expect(allResultsSuccess(results)).toBeTruthy();
});

afterAll(async () => {
  await cleanUp(tester.account_id);
});

/*
Arguments: {
  "actions": [
    {
      "pool_id": 20,
      "token_in":WNEAR_CONTRACT_ID,
      "token_out": ndaiContract,
      "amount_in": "1000000000000000000000000",
      "min_amount_out": "91479657"
    }
  ]
}
Swap from wNEAR to nDAI, then test with nDAI to nUSDC?
*/
