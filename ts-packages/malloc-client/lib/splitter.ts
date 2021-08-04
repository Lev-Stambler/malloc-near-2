import BN from "bn.js";
import { Account } from "near-api-js";
import {
  AccountId,
  BigNumberish,
  Node,
  RunEphemeralOpts,
  SpecialAccount,
  Splitter,
  Transaction,
  MallocCallMetadata,
} from "./interfaces";
import { executeMultipleTx, MAX_GAS } from "./tx";

const defaultRunEphemeralOpts: RunEphemeralOpts = {
  gas: MAX_GAS,
  depositTransactionHash: null,
};

/**
 * @param  {SpecialAccount} callerAccount
 * @param  {Node} node
 * @returns Promise
 */
const getNodeAttachedDeposit = async (
  callerAccount: SpecialAccount,
  node: Node
): Promise<BN> => {
  if (node.MallocCall) {
    const metadata: MallocCallMetadata = await callerAccount.viewFunction(
      node.MallocCall.contract_id,
      "metadata"
    );
    return new BN(metadata.minimum_attached_deposit || 1);
  }
};

const getAttachedDepositForSplitter = async (
  callerAccount: SpecialAccount,
  splitter: Splitter
): Promise<BN> => {
  const nodeAttachedDeposits = await Promise.all(
    splitter.children.map((node, i) => {
      return getNodeAttachedDeposit(callerAccount, node);
    })
  );
  const add = (a: BN, b: BN) => a.add(b);
  const nodesSummed = nodeAttachedDeposits.reduce(add, new BN(0));
  return nodesSummed;
};

const getAttachedDeposit = async (
  caller: SpecialAccount,
  splitters: Splitter[]
): Promise<BN> => {
  const deps = await Promise.all(
    splitters.map((splitter) => getAttachedDepositForSplitter(caller, splitter))
  );
  return deps.reduce((a, b) => a.add(b), new BN(0));
};

export const runEphemeralSplitter = async (
  callerAccount: SpecialAccount,
  mallocAccountId: AccountId,
  splitters: Splitter[],
  amount: BigNumberish,
  opts?: Partial<RunEphemeralOpts>
): Promise<Transaction[]> => {
  const _opts: RunEphemeralOpts = {
    ...defaultRunEphemeralOpts,
    ...(opts || {}),
  };
  const attachedDeposit = await getAttachedDeposit(callerAccount, splitters);
  const txs = [
    {
      receiverId: mallocAccountId,
      functionCalls: [
        {
          methodName: "run_ephemeral",
          args: {
            splitters,
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
