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
  NextSplitterIndices,
  ConstructionId,
  ConstructionCall,
  SpecialAccountWithKeyPair,
  TransactionWithPromiseResultFlag,
  ConstructionCallId,
} from "./interfaces";
import {
  executeMultipleTx,
  MAX_GAS,
  resolveTransactionsReducedWithPromises,
} from "./tx";

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

const makeid = (length: number) => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const getConstructionCallData = async (
  callerAccount: SpecialAccount,
  mallocAccountId: AccountId,
  constructionCallId: string
): Promise<ConstructionCall> => {
  return await callerAccount.viewFunction(
    mallocAccountId,
    "get_construction_call_unchecked",
    { id: constructionCallId }
  );
};

const checkSuccessful = async (hashes: string[], accountId: string) => {
  const ret = await resolveTransactionsReducedWithPromises(hashes, accountId);
  if (ret.flag !== TransactionWithPromiseResultFlag.SUCCESS) {
    throw ret.message;
  }
};

/**
 * runEphemeralConstruction will create a construction with a random name and then delete it
 */
export const runEphemeralConstruction = async (
  callerAccount: SpecialAccountWithKeyPair,
  mallocAccountId: AccountId,
  splitters: Splitter[],
  next_splitters_idxs: NextSplitterIndices,
  amount: BigNumberish,
  opts?: Partial<RunEphemeralOpts>
): Promise<void> => {
  const _opts: RunEphemeralOpts = {
    ...defaultRunEphemeralOpts,
    ...(opts || {}),
  };
  const construction_call_id = makeid(16);
  const constructionName = makeid(10);

  const storeAndStartConstruction = async () => {
    const attachedDeposit = await getAttachedDepositForSplitter(
      callerAccount,
      splitters[0]
    );
    const txs = [
      {
        receiverId: mallocAccountId,
        functionCalls: [
          {
            methodName: "register_construction",
            args: {
              construction_name: constructionName,
              splitters,
              next_splitters: next_splitters_idxs,
              amount: amount.toString(),
            },
            gas: _opts.gas.toString(),
            amount: "0", //TODO: storage deposit goes here ya heard
          },
        ],
      },
      {
        receiverId: mallocAccountId,
        functionCalls: [
          {
            methodName: "start_construction",
            args: {
              construction_id: {
                owner: callerAccount.accountId,
                name: constructionName,
              } as ConstructionId,
              construction_call_id,
              amount: amount.toString(),
            },
            gas: _opts.gas.toString(),
            amount: attachedDeposit.toString(),
          },
        ],
      },
    ];

    const txRetsInit = await executeMultipleTx(callerAccount, txs);

    // Throws if unsuccessful
    await checkSuccessful(txRetsInit, callerAccount.accountId);
  };

  const runNextSplitterCalls = async () => {
    let constructionCallData = await getConstructionCallData(
      callerAccount,
      mallocAccountId,
      construction_call_id
    );

    while (constructionCallData.splitter_call_errors.length > 0) {
      console.log(constructionCallData);
      const splitter_idx =
        constructionCallData.next_splitter_call_stack[
          constructionCallData.next_splitter_call_stack.length - 1
        ].index_into_splitters;
      const attachedDeposit = await getAttachedDepositForSplitter(
        callerAccount,
        splitters[parseInt(splitter_idx.toString())]
      );
      const txs = [
        {
          receiverId: mallocAccountId,
          functionCalls: [
            {
              methodName: "process_next_split_call",
              args: {
                construction_call_id,
              },
              gas: _opts.gas.toString(),
              amount: attachedDeposit.toString(),
            },
          ],
        },
      ];

      const txRets = await executeMultipleTx(callerAccount, txs);

      // Throws if unsuccessful
      await checkSuccessful(txRets, callerAccount.accountId);

      constructionCallData = await getConstructionCallData(
        callerAccount,
        mallocAccountId,
        construction_call_id
      );
    }
  };

  await storeAndStartConstruction();
  await runNextSplitterCalls();
};
