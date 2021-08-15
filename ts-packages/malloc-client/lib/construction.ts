import BN from "bn.js";
import { Account } from "near-api-js";
import {
  AccountId,
  BigNumberish,
  Node,
  SpecialAccount,
  Transaction,
  MallocCallMetadata,
  ConstructionId,
  ConstructionCall,
  SpecialAccountWithKeyPair,
  TransactionWithPromiseResultFlag,
  ConstructionCallId,
  TxHashOrVoid,
  RegisterConstructionArgs,
  RegisterNodesArgs,
  Construction,
  ProcessNextNodeCallArgs,
  InitConstructionArgs,
  NodeCall,
  NodeCallId,
  CallEphemeralError,
} from "./interfaces";
import { getNodeAttachedDepositForNode } from "./node";
import {
  executeMultipleTx,
  MAX_GAS,
  MAX_GAS_STR,
  resolveTransactionsReducedWithPromises,
} from "./tx";

interface RunEphemeralOpts {
  gas: BigNumberish;
  depositTransactionHash?: string | null;
}

const defaultRunEphemeralOpts: RunEphemeralOpts = {
  gas: MAX_GAS,
  depositTransactionHash: null,
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
  ];

  const txRetsInit = await executeMultipleTx(callerAccount, txs);

  //@ts-ignore
  if (txRetsInit instanceof Array) return txRetsInit[0];
  //@ts-ignore
  return txRetsInit;
};

export const getNodeCallData = async (
  callerAccount: SpecialAccount,
  mallocAccountId: AccountId,
  nodeCallId: NodeCallId
): Promise<NodeCall> => {
  return await callerAccount.viewFunction(
    mallocAccountId,
    "get_node_call_unchecked",
    { id: nodeCallId.toString() }
  );
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
    throw JSON.stringify(ret.message);
  }
};

/**
 * runEphemeralConstruction will create a construction with a random name and then delete it
 *
 * @error Errors with a object of type CallEphemeralError
 * {@link CallEphemeralError | CallEphemeralError interface}
 */
export const runEphemeralConstruction = async (
  callerAccount: SpecialAccount,
  mallocAccountId: AccountId,
  nodes: Node[],
  amount: BigNumberish,
  initial_node_indices: number[],
  initial_splits: number[],
  next_nodes_indices: number[][][],
  next_nodes_splits: number[][][],
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
        ],
      },
    ];

    const initTx = [
      {
        receiverId: mallocAccountId,
        functionCalls: [
          {
            methodName: "init_construction",
            args: {
              construction_call_id,
              construction_id: {
                name: constructionName,
                owner: callerAccount.accountId,
              },
              amount: amount.toString(),
              initial_node_indices: initial_node_indices,
              initial_splits: initial_splits,
              next_nodes_indices,
              next_nodes_splits,
            } as InitConstructionArgs,
            gas: MAX_GAS.divn(3).toString(),
            amount: "0", //TODO: storage deposit goes here ya heard
          },
        ],
      },
    ];

    const txRetsInit = await executeMultipleTx(callerAccount, [
      ...txs,
      ...initTx,
    ]);

    // Throws if unsuccessful
    await checkTransactionSuccessful(txRetsInit || [], callerAccount.accountId);

    return txRetsInit || [];
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

      const node_call_id = constructionCallData.node_calls[node_call_index];
      const node_call = await getNodeCallData(
        callerAccount,
        mallocAccountId,
        node_call_id as any
      );

      const attachedDeposit = await getNodeAttachedDepositForNode(
        callerAccount,
        nodes[parseInt(node_call.node_index_in_construction.toString())]
      );

      // TODO: get || to work !!!!!!!
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
                amount: "0", //TODO: consider adding back //attachedDeposit.toString(),
              },
            ],
          };
        });

      const txRets = await executeMultipleTx(callerAccount, txs);

      // Throws if unsuccessful
      await checkTransactionSuccessful(txRets || [], callerAccount.accountId);
      txHashes.push(...(txRets || []));

      constructionCallData = await getConstructionCallData(
        callerAccount,
        mallocAccountId,
        construction_call_id
      );
      console.log(constructionCallData);
    }
    return txHashes;
  };

  try {
    const txsInit = await storeAndStartConstruction();
    const txsNextStep = await runNextNodeCalls();
    return [...txsInit, ...txsNextStep];
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
