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
  CallEphemeralError,
  TxHashOrVoid,
  RegisterConstructionArgs,
  RegisterNodesArgs,
  Construction,
  ProcessNextNodeCallArgs,
  InitConstructionArgs,
} from "./interfaces";
import {
  executeMultipleTx,
  MAX_GAS,
  MAX_GAS_STR,
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
const getNodeAttachedDepositForNode = async (
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

const getAttachedDeposit = async (
  caller: SpecialAccount,
  nodes: Node[]
): Promise<BN> => {
  const deps = await Promise.all(
    nodes.map((n) => getNodeAttachedDepositForNode(caller, n))
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

/**
 * @returns the transaction's hash
 */
export const deleteConstruction = async <
  SpecialAccountGeneric extends SpecialAccount
>(
  callerAccount: SpecialAccountGeneric,
  mallocAccountId: AccountId,
  constructionId: ConstructionId
): Promise<TxHashOrVoid<SpecialAccountGeneric>> => {
  const txs = [
    {
      receiverId: mallocAccountId,
      functionCalls: [
        {
          methodName: "delete_construction",
          args: {
            construction_id: constructionId,
          },
          gas: MAX_GAS_STR,
          amount: "0", //TODO: storage deposit goes here ya heard
        },
      ],
    },
    ,
  ];

  const txRetsInit = await executeMultipleTx(callerAccount, txs);

  //@ts-ignore
  if (txRetsInit instanceof Array) return txRetsInit[0];
  //@ts-ignore
  return txRetsInit;
};

export const getConstructionCallData = async (
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

const checkTransactionSuccessful = async (
  hashes: string[],
  accountId: string
) => {
  const ret = await resolveTransactionsReducedWithPromises(hashes, accountId);
  if (ret.flag !== TransactionWithPromiseResultFlag.SUCCESS) {
    throw ret.message;
  }
};

/**
 * runEphemeralConstruction will create a construction with a random name and then delete it
 *
 * @error Errors with a object of type CallEphemeralError
 * {@link CallEphemeralError | CallEphemeralError interface}
 */
export const runEphemeralConstruction = async (
  callerAccount: SpecialAccountWithKeyPair,
  mallocAccountId: AccountId,
  nodes: Node[],
  amount: BigNumberish,
  opts?: Partial<RunEphemeralOpts>
): Promise<string[]> => {
  const _opts: RunEphemeralOpts = {
    ...defaultRunEphemeralOpts,
    ...(opts || {}),
  };
  const construction_call_id = makeid(16);
  const constructionName = makeid(10);
  const nodeNames = nodes.map((n) => makeid(12));
  const construction: Construction = {
    nodes: nodeNames.map((name) => {
      return {
        name,
        owner: callerAccount.accountId,
      };
    }),
  };

  // TODO: move this out to a separate function and test registration
  // Use the get malloc call state for testing!
  const storeAndStartConstruction = async (): Promise<string[]> => {
    // const attachedDeposit = await getNodeAttachedDepositForNode(
    //   callerAccount,
    //   nodes[0]
    // );
    const txs = [
      {
        receiverId: mallocAccountId,
        functionCalls: [
          {
            methodName: "register_nodes",
            args: {
              node_names: nodeNames,
              nodes: nodes,
            } as RegisterNodesArgs,
            gas: MAX_GAS.divn(3).toString(),
            amount: "0", // TODO: storage
          },
          {
            methodName: "register_construction",
            args: {
              construction_name: constructionName,
              construction,
            } as RegisterConstructionArgs,
            gas: MAX_GAS.divn(3).toString(),
            amount: "0", //TODO: storage deposit goes here ya heard
          },
          {
            methodName: "init_construction",
            args: {
              construction_call_id,
              construction_id: {
                name: constructionName,
                owner: callerAccount.accountId,
              },
              amount: amount.toString(),
              initial_node_indices: [0, 1], //TODO:
              initial_splits: [1, 1],
            } as InitConstructionArgs,
            gas: MAX_GAS.divn(3).toString(),
            amount: "0", //TODO: storage deposit goes here ya heard
          },
        ],
      },
      // {
      //   receiverId: mallocAccountId,
      //   functionCalls: [
      //     {
      //       methodName: "init_construction",
      //       args: {
      //         construction_id: {
      //           owner: callerAccount.accountId,
      //           name: constructionName,
      //         } as ConstructionId,
      //         construction_call_id,
      //         amount: amount.toString(),
      //       },
      //       gas: _opts.gas.toString(),
      //       amount: attachedDeposit.toString(),
      //     },
      //   ],
      // },
    ];

    const txRetsInit = await executeMultipleTx(callerAccount, txs);

    // Throws if unsuccessful
    await checkTransactionSuccessful(txRetsInit, callerAccount.accountId);

    return txRetsInit;
  };

  const runNextNodeCalls = async (): Promise<string[]> => {
    let constructionCallData = await getConstructionCallData(
      callerAccount,
      mallocAccountId,
      construction_call_id
    );
    let txHashes: string[] = [];

    while (constructionCallData.next_node_calls_stack.length > 0) {
      const node_call_index =
        constructionCallData.next_node_calls_stack[
          constructionCallData.next_node_calls_stack.length - 1
        ];

      const node_index_in_construction =
        constructionCallData.node_calls[node_call_index]
          .node_index_in_construction;

      const attachedDeposit = await getNodeAttachedDepositForNode(
        callerAccount,
        nodes[parseInt(node_index_in_construction.toString())]
      );
      const txs: Transaction[] = new Array(
        constructionCallData.next_node_calls_stack.length
      )
        .fill(0)
        .map((_) => {
          return {
            receiverId: mallocAccountId,
            functionCalls: [
              {
                methodName: "process_next_node_call",
                args: {
                  construction_call_id,
                } as ProcessNextNodeCallArgs,
                gas: _opts.gas.toString(),
                amount: attachedDeposit.toString(),
              },
            ],
          };
        });

      const txRets = await executeMultipleTx(callerAccount, txs);

      // Throws if unsuccessful
      await checkTransactionSuccessful(txRets, callerAccount.accountId);
      txHashes.push(...txRets);

      constructionCallData = await getConstructionCallData(
        callerAccount,
        mallocAccountId,
        construction_call_id
      );
    }
    return txHashes;
  };

  try {
    const txsInit = await storeAndStartConstruction();
    // const txsNextStep = await runNextNodeCalls(); // TODO: add back
    return [...txsInit]; //, ...txsNextStep];
  } catch (e) {
    console.trace(e);
    const call_state = await getConstructionCallData(
      callerAccount,
      mallocAccountId,
      construction_call_id
    );
    console.info(
      "The error resolved with malloc in the following state",
      JSON.stringify(call_state)
    );
    throw {
      ...e,
      constructionCallId: construction_call_id,
    } as CallEphemeralError;
  }
};
