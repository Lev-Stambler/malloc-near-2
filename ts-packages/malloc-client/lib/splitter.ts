import BN from "bn.js";
import { Account } from "near-api-js";
import {
  AccountId,
  BigNumberish,
  Endpoint,
  RunEphemeralOpts,
  SpecialAccount,
  Splitter,
  Transaction,
  MallocCallMetadata,
} from "./interfaces";
import { executeMultipleTx, MAX_GAS } from "./tx";
import { sumSplits } from "./utils";

const defaultRunEphemeralOpts: RunEphemeralOpts = {
  gas: MAX_GAS,
  depositTransactionHash: null,
};

/**
 * @param  {SpecialAccount} callerAccount
 * @param  {Endpoint} node
 * @param  {BN} amountForEndpoint? amount is only required in calculations for a simple transfer
 * @returns Promise
 */
const getNodeAttachedDeposit = async (
  callerAccount: SpecialAccount,
  node: Endpoint,
  amountForEndpoint?: BN
): Promise<BN> => {
  if (node.MallocCall) {
    const metadata: MallocCallMetadata = await callerAccount.viewFunction(
      node.MallocCall.contract_id,
      "metadata"
    );
    return new BN(metadata.minimum_attached_deposit || 1);
  } else if (node.FTTransfer) {
    return new BN(1);
  } else if (node.SimpleTransfer) {
    return new BN(amountForEndpoint).addn(1);
  }
};

const getAttachedDeposit = async (
  callerAccount: SpecialAccount,
  splitter: Splitter,
  amount: BN
): Promise<BN> => {
  const totalSplits = sumSplits(splitter.splits);
  const nodeAttachedDeposits = await Promise.all(
    splitter.nodes.map((endpoint, i) => {
      const amountForEndpoint = amount
        .mul(new BN(splitter.splits[i]))
        .div(totalSplits);
      return getNodeAttachedDeposit(callerAccount, endpoint, amountForEndpoint);
    })
  );
  const add = (a: BN, b: BN) => a.add(b);
  const nodesSummed = nodeAttachedDeposits.reduce(add, new BN(0));
  return nodesSummed;
};

export const runEphemeralSplitter = async (
  callerAccount: SpecialAccount,
  mallocAccountId: AccountId,
  splitter: Splitter,
  amount: BigNumberish,
  opts?: Partial<RunEphemeralOpts>
): Promise<Transaction[]> => {
  const _opts: RunEphemeralOpts = {
    ...defaultRunEphemeralOpts,
    ...(opts || {}),
  };
  const attachedDeposit = await getAttachedDeposit(
    callerAccount,
    splitter,
    new BN(amount)
  );
  const txs = [
    {
      receiverId: mallocAccountId,
      functionCalls: [
        {
          methodName: "run_ephemeral",
          args: {
            splitter,
            amount: amount.toString(),
          },
          gas: _opts.gas.toString(),
          amount: attachedDeposit.toString(),
        },
      ],
    },
  ];
  return txs;
};
