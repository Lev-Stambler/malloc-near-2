import {
  AccountId,
  MallocCall,
  Action,
  ActionCall,
  FtTransferCallToMallocCall,
  WithdrawFromMallocCall as MallocClientWithdrawFromMallocCall,
  SpecialAccount,
  ActionTypesLibraryFacing,
} from "@malloc/sdk";
import {
  ConstructionReturn,
  FtTransferCallToMallocCallActionReturn,
  IConstruction,
  IFtTransferCallToMallocCallAction,
  IMallocCallAction,
  MallocCallActionReturn,
  MallocCallOpts,
  ActionOrConstructionWithSplit,
  GenericParameters,
  RunEphemeralInstr,
  ICompileConstruction,
  ActionOrConstructionWithSplitParametersFilled,
  ActionOutputsForConstruction,
  ActionOutputsForConstructionWithParamsFilled,
  IWithdrawFromMallocCall,
  WithdrawFromMallocCallReturn,
  WithdrawFromMallocCallParams,
  IRunEphemeralConstruction,
} from "./interfaces";
import {
  INTERNAL_CONSTRUCTION_TYPE,
  _InternalConstruction,
} from "./internal/construction-internal";
import { resolveParameters } from "./internal/parameter-replacement-internal";

export const MallocCallAction = <T>(
  input: IMallocCallAction
): MallocCallActionReturn => {
  return (parameters?: GenericParameters) => {
    return (parametersFromParent?: GenericParameters) => {
      const params: GenericParameters = resolveParameters(
        parameters || {},
        parametersFromParent
      );

      const callArgsFiltered = input.callArgNames.reduce((prev, key) => {
        const val = params[key] || (input.prefilledParameters || {})[key];
        if (!val)
          throw `Expected a call argument with key ${key} to be present in the parameters for the Malloc Call`;
        prev[key] = val;
        return prev;
      }, {} as any);

      const tokenId = validateInputToken(
        input.prefilledParameters?.tokenIn || params?.tokenIn
      );
      const ret: Action<MallocCall> = {
        MallocCall: {
          malloc_call_id: input.mallocCallContractID,
          json_args: JSON.stringify({
            ...callArgsFiltered,
          }),
          token_id: tokenId,
        },
      };
      return ret;
    };
  };
};

export const WithdrawFromMallocCall = (
  input: IWithdrawFromMallocCall
): WithdrawFromMallocCallReturn => {
  return (parameters?: WithdrawFromMallocCallParams) => {
    return (parametersFromParents?: GenericParameters) => {
      const params = resolveParameters(parameters || {}, parametersFromParents);
      const tokenIn = validateInputToken(input.tokenIn || params?.tokenIn);
      return {
        WithdrawFromMallocCall: {
          malloc_call_id: input.mallocCallContractID,
          token_id: tokenIn,
          recipient: input.recipient || params?.recipient || undefined,
        },
      } as Action<MallocClientWithdrawFromMallocCall>;
    };
  };
};

export const FtTransferCallToMallocCallAction = (
  input: IFtTransferCallToMallocCallAction
): FtTransferCallToMallocCallActionReturn => {
  return (parameters?: { tokenIn?: string }) => {
    return (parametersFromParent?: { tokenIn?: string }) => {
      const params = resolveParameters(parameters || {}, parametersFromParent);
      const tokenIn = validateInputToken(input.tokenIn || params?.tokenIn);
      return {
        FtTransferCallToMallocCallAction: {
          malloc_call_id: input.mallocCallContractID,
          token_id: tokenIn,
        },
      } as Action<FtTransferCallToMallocCall>;
    };
  };
};

export const Construction = (input: IConstruction): ConstructionReturn => {
  return (parameters?: GenericParameters) => {
    return (parametersFromParent?: GenericParameters) => {
      const params = resolveParameters(parameters || {}, parametersFromParent);
      const output: ActionOutputsForConstructionWithParamsFilled | null =
        input.out ? fillFractionSplitsAndToken(input.out, params) : null;
      return _InternalConstruction.fromConstructionInOut(
        input.in(params),
        output
      );
    };
  };
};

export const runEphemeralConstruction = async <AccountType extends SpecialAccount>(
  input: IRunEphemeralConstruction<AccountType>
): Promise<void> => {
  const initialInternalConstructions: _InternalConstruction[] =
    input.initialConstructionOrActions.map((e) => {
      const elem = e.element;
      if ((elem as _InternalConstruction).type === INTERNAL_CONSTRUCTION_TYPE) {
        return elem as _InternalConstruction;
      } else {
        return _InternalConstruction.fromActionEndpoint(
          elem as Action<ActionTypesLibraryFacing>
        );
      }
    });
  const merged = _InternalConstruction.mergeMulti(initialInternalConstructions);
  if (!merged)
    throw "Expected there to be at least 1 valid construction or action in initial construction or actions";
  let initSplits =  input.initialConstructionOrActions.map(e => e.fraction)
  await input.mallocClient.runEphemeralConstruction({
    actions: merged.actions,
    nextActionsIndices: merged.nextActionsIndices,
    nextActionsSplits: merged.nextActionsSplits,
    initialActionIndices: merged.initialIndices,
    initialSplits: initSplits,
    amount: input.amount
  })
};

// ---------------- Helper functions

const validateInputToken = (tokenId?: string): string => {
  if (!tokenId)
    throw "Expected a tokenIn from either the prefilled parameters of from the given parameters";
  return tokenId;
};

const fillFractionSplitsAndToken = (
  actionOutput: ActionOutputsForConstruction,
  params: GenericParameters
): ActionOutputsForConstructionWithParamsFilled => {
  return Object.keys(actionOutput).reduce((prior, tokenIdOrParam: string) => {
    // First guess that the tokenId is a parameter. If no such parameter exists, assume that it is the raw token id
    const outputsForTok = actionOutput[tokenIdOrParam];
    const tokenIdOut = params[tokenIdOrParam] || tokenIdOrParam;
    const paramsWithToken: GenericParameters = {
      tokenIn: tokenIdOut,
      ...params,
    };
    const withSplitsFilled: ActionOrConstructionWithSplitParametersFilled[] =
      outputsForTok.map((o) => {
        // If the fraction part is a string, assume that it needs to be filled in
        if (typeof o.fraction === "string") {
          const val = params[o.fraction];
          if (!val) throw "Expected param here, TODO: err lib";
          else if (typeof val !== "number")
            throw "Expected the parameter for fraction to be a number";
          return {
            element: o.element(paramsWithToken),
            fraction: val as number,
          };
        }

        return {
          element: o.element(paramsWithToken),
          fraction: o.fraction as number,
        };
      });
    prior[tokenIdOut] = withSplitsFilled;
    return prior;
  }, {} as ActionOutputsForConstructionWithParamsFilled);
};
