import {
  AccountId,
  MallocCall,
  Action,
  ActionCall,
  FtTransferCallToMallocCall,
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
} from "./interfaces";
import { _InternalConstruction } from "./internal/construction-internal";
import { resolveParameters } from "./internal/parameter-replacement-internal";

export const MallocCallAction = <T>(
  input: IMallocCallAction
): MallocCallActionReturn => {
  return (parameters?: GenericParameters) => {
    return (parametersFromParent?: GenericParameters) => {
      const params = resolveParameters(parameters || {}, parametersFromParent);
      const tokenId = input.prefilledParameters?.tokenIn || params?.tokenIn;
      if (!tokenId)
        throw "AAAExpected a tokenIn from either the prefilled parameters of from the given parameters";
      const ret: Action<MallocCall> = {
        MallocCall: {
          malloc_call_id: input.mallocCallContractID,
          // TODO: json args go how????
          json_args: JSON.stringify({
            ...(input.prefilledParameters || {}),
            ...(params || {}),
          }),
          token_id: tokenId,
        },
      };
      return ret;
    };
  };
};

export const FtTransferCallToMallocCallAction = (
  input: IFtTransferCallToMallocCallAction
): FtTransferCallToMallocCallActionReturn => {
  return (parameters?: { tokenIn?: string }) => {
    return (parametersFromParent?: { tokenIn?: string }) => {
      const params = resolveParameters(parameters || {}, parametersFromParent);
      console.log(params);
      const tokenIn = input.tokenIn || params?.tokenIn;
      if (!tokenIn)
        throw "AAAExpected a tokenIn from either the prefilled parameters of from the given parameters";
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
        input.out ? fillFractionSplitsAndTokenIn(input.out, params) : null;
      return _InternalConstruction.fromConstructionInOut(
        input.in(params),
        output
      );
    };
  };
};

export const compileConstruction = (
  input: ICompileConstruction
): Promise<RunEphemeralInstr> => {
  throw "TODO";
};

export const runEphemeralConstruction = (
  instruction: RunEphemeralInstr,
  amount: string
): Promise<void> => {
  throw "TODO";
};

// ---------------- Helper functions

const fillFractionSplitsAndTokenIn = (
  actionOutput: ActionOutputsForConstruction,
  params: GenericParameters
): ActionOutputsForConstructionWithParamsFilled => {
  return Object.keys(actionOutput).reduce((prior, tokenId: string) => {
    const outputsForTok = actionOutput[tokenId];
    const paramsWithToken: GenericParameters = { tokenIn: tokenId, ...params };
    const withSplitsFilled: ActionOrConstructionWithSplitParametersFilled[] =
      outputsForTok.map((o) => {
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
          element: o.element,
          fraction: o.fraction as number,
        };
      });
    prior[tokenId] = withSplitsFilled;
    return prior;
  }, {} as ActionOutputsForConstructionWithParamsFilled);
};
