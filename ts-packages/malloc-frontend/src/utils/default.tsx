import { Splitter } from "@malloc/sdk";
import BN from "bn.js";
const amountWNear = "10000000000000000000";
const REF_FINANCE_CONTRACT = "ref-finance.testnet";
const wNearToDAIPoolId = 20;
const WNEAR_CONTRACT_ID = "wrap.testnet";
const NDAI_CONTRACT_ID = "ndai.ft-fin.testnet";
export const WCALL_SIMPLE_GAS = new BN("15000000000000");

export const defaultSplitter: Splitter = {
  splits: [100, 100],
  nodes: [
    {
      FTTransfer: {
        recipient: "lev.testnet",
      },
    },
    {
      FTTransfer: {
        recipient: "lev.testnet",
      },
    },
    {
      WCall: {
        contract_id: "dev-1627905502508-9608400",
        gas: WCALL_SIMPLE_GAS.toNumber(),
        attached_amount: "5",
        json_args: JSON.stringify({
          pool_id: wNearToDAIPoolId,
          token_in: WNEAR_CONTRACT_ID,
          amount_in: amountWNear,
          token_out: NDAI_CONTRACT_ID,
        }),
      },
    },
  ],
  ft_contract_id: "wrap.testnet",
};
