import BN from "bn.js";
import { Account, KeyPair } from "near-api-js";
import { actionLibraryFacingToContractFacing } from "./action";
import {
  AccountId,
  BigNumberish,
  TxAction,
  SpecialAccount,
  Transaction,
  MallocCallMetadata,
  ConstructionId,
  ConstructionCall,
  SpecialAccountWithKeyPair,
  TransactionWithPromiseResultFlag,
  ConstructionCallId,
  TxHashOrUndefined,
  RegisterConstructionArgs,
  RegisterActionsArgs,
  Construction,
  ProcessNextActionCallArgs,
  InitConstructionArgs,
  ActionCall,
  ActionCallId,
  CallEphemeralError,
  ActionTypesLibraryFacing,
  ActionTypesContractFacing,
  Action,
} from "./interfaces";
import {
  executeMultipleTx,
  executeMultipleTxNoDeposit,
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
): Promise<TxHashOrUndefined<SpecialAccountGeneric>> => {
  const txs: Transaction[] = [
    {
      receiverId: mallocAccountId,
      actions: [
        {
          functionCall: {
            methodName: "delete_construction",
            args: {
              construction_id: constructionId,
            },
            gas: MAX_GAS_STR,
            amount: "0", //TODO: storage deposit goes here ya heard
          },
        },
      ],
    },
  ];

  const txRetsInit = await executeMultipleTxNoDeposit(callerAccount, txs, {});

  //@ts-ignore
  if (txRetsInit instanceof Array) return txRetsInit[0];
  //@ts-ignore
  return txRetsInit;
};

export const getActionCallData = async (
  callerAccount: SpecialAccount,
  mallocAccountId: AccountId,
  actionCallId: ActionCallId
): Promise<ActionCall> => {
  return await callerAccount.viewFunction(
    mallocAccountId,
    "get_action_call_unchecked",
    { id: actionCallId.toString() }
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
  actions: Action<ActionTypesLibraryFacing>[],
  amount: BigNumberish,
  initial_action_indices: number[],
  initial_splits: BigNumberish[],
  next_actions_indices: number[][][],
  next_actions_splits: BigNumberish[][][],
  signerKp: KeyPair,
  opts?: Partial<RunEphemeralOpts>
): Promise<string[]> => {
  const _opts: RunEphemeralOpts = {
    ...defaultRunEphemeralOpts,
    ...(opts || {}),
  };
  const construction_call_id = makeid(16);
  const constructionName = makeid(10);
  const actionNames = actions.map((n) => makeid(12));
  const construction: Construction = {
    actions: actionNames.map((name) => {
      return {
        name,
        owner: callerAccount.accountId,
      };
    }),
  };

  const actionsContractFacing: Action<ActionTypesContractFacing>[] =
    await Promise.all(
      actions.map((action) =>
        actionLibraryFacingToContractFacing(callerAccount, action)
      )
    );

  // TODO: move this out to a separate function and test registration
  // Use the get malloc call state for testing!
  const storeAndStartConstruction = async (): Promise<string[]> => {
    // const attachedDeposit = await getActionAttachedDepositForAction(
    //   callerAccount,
    //   actions[0]
    // );
    const txs: Transaction[] = [
      {
        receiverId: mallocAccountId,
        actions: [
          {
            functionCall: {
              methodName: "register_actions",
              args: {
                action_names: actionNames,
                actions: actionsContractFacing,
              } as RegisterActionsArgs,
              gas: MAX_GAS.toString(),
              amount: "0", // TODO: storage
            },
          },
        ],
      },
      {
        receiverId: mallocAccountId,
        actions: [
          {
            functionCall: {
              methodName: "register_construction",
              args: {
                construction_name: constructionName,
                construction,
              } as RegisterConstructionArgs,
              gas: MAX_GAS.toString(),
              amount: "0", //TODO: storage deposit goes here ya heard
            },
          },
        ],
      },
    ];

    const initTx: Transaction[] = [
      {
        receiverId: mallocAccountId,
        actions: [
          {
            functionCall: {
              methodName: "init_construction",
              args: {
                construction_call_id,
                construction_id: {
                  name: constructionName,
                  owner: callerAccount.accountId,
                },
                amount: amount.toString(),
                initial_action_indices: initial_action_indices,
                initial_splits: initial_splits.map((i) => i.toString()),
                next_actions_indices,
                next_actions_splits: next_actions_splits.map((o) =>
                  o.map((o) => o.map((item) => item.toString()))
                ),
              } as InitConstructionArgs,
              gas: MAX_GAS.divn(3).toString(),
              amount: "0", //TODO: storage deposit goes here ya heard
            },
          },
        ],
      },
    ];

    const txRetsInit = await executeMultipleTxNoDeposit(callerAccount, [
      ...txs,
      ...initTx,
    ]);

    // Throws if unsuccessful
    await checkTransactionSuccessful(txRetsInit || [], callerAccount.accountId);

    return txRetsInit || [];
  };

  const runNextActionCalls = async (): Promise<string[]> => {
    let constructionCallData = await getConstructionCallData(
      callerAccount,
      mallocAccountId,
      construction_call_id
    );
    let txHashes: string[] = [];

    while (constructionCallData.next_action_calls_stack.length > 0) {
      const action_call_index =
        constructionCallData.next_action_calls_stack[
          constructionCallData.next_action_calls_stack.length - 1
        ];

      const action_call_id =
        constructionCallData.action_calls[action_call_index];
      const action_call = await getActionCallData(
        callerAccount,
        mallocAccountId,
        action_call_id as any
      );
      // console.log(action_call);
      console.log(constructionCallData);
      const txs: Transaction[] = new Array(
        constructionCallData.next_action_calls_stack.length
      )
        .fill(0)
        .map((_) => {
          return {
            receiverId: mallocAccountId,
            actions: [
              {
                functionCall: {
                  methodName: "process_next_action_call",
                  args: {
                    construction_call_id,
                  } as ProcessNextActionCallArgs,
                  gas: _opts.gas.toString(),
                  amount: "0", //TODO: consider adding back //attachedDeposit.toString(),
                },
              },
            ],
          };
        });

      const txRets = await executeMultipleTxNoDeposit(callerAccount, txs, {});

      // Throws if unsuccessful
      await checkTransactionSuccessful(txRets || [], callerAccount.accountId);
      txHashes.push(...(txRets || []));

      constructionCallData = await getConstructionCallData(
        callerAccount,
        mallocAccountId,
        construction_call_id
      );
    }
    return txHashes;
  };
  // TODO: delete the construction once all is done!!

  try {
    const txsInit = await storeAndStartConstruction();
    await resolveTransactionsReducedWithPromises(
      txsInit,
      callerAccount.accountId
    );
    const txsNextStep = await runNextActionCalls();
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
