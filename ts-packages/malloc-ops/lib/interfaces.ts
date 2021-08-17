import {
  AccountId,
  Construction,
  FtTransferCallToMallocCall,
  InitConstructionArgs,
  IRunEphemeralConstruction,
  MallocCall,
  Action,
  ActionTypes,
  ActionTypesLibraryFacing,
} from "@malloc/sdk";
import { _InternalConstruction } from "./construction-internal";

// ---------------- Base interface

export interface ActionOrConstructionWithSplitParametersFilled {
  element:
    | ReturnType<ReturnType<MallocCallActionReturn>>
    | ReturnType<ReturnType<FtTransferCallToMallocCallActionReturn>>
    | ReturnType<ReturnType<ConstructionReturn>>;
  // If a string is used, assume that a parameter is being used for the fraction
  fraction: number;
}
export interface ActionOrConstructionWithSplit {
  element:
    | ReturnType<MallocCallActionReturn>
    | ReturnType<FtTransferCallToMallocCallActionReturn>
    | ReturnType<ConstructionReturn>;
  // If a string is used, assume that a parameter is being used for the fraction
  fraction: number | string;
}

// -------------- Parameter Interfaces

export interface BindedParameter {
  type: "BINDED_PARAMETER";
  name: string;
}

/**
 * Parameters passed into both Actions and Constructions
 *
 * If a parameter is a string and begins with a $$, then assume that it is a binded
 */
export interface GenericParameters {
  tokenIn?: AccountId;
  expectedTokensOut?: AccountId[];
  [args: string]: any | BindedParameter;
}

/**
 * Names of parameters which are passed into the Action and Construction builder
 * functions. The first string is the name of the parameter to the caller while the second is the
 * name of the parameter for the actual action or construction. So if an action requires a `message`
 * parameter, it can be aliased to a `myCoolMessage` name which is later filled in by this library and replaced to `message`
 *
 * If the parameter name is just a string, then assume that the name for the parameter is the same as the one used for the actual action or construction
 */
type ParameterNames = (
  | [string, "tokenIn" | "expectedTokensOut" | string]
  | string
)[];

// ----------------- Malloc Call Action Interfaces

interface MallocCallOverrides {
  checkCallback?: boolean;
  gasForCall?: number;
  attachedAmount?: number;
}

export interface IMallocCallAction {
  mallocCallContractID: AccountId;
  prefilledParamets?: GenericParameters;
  parameterNames?: ParameterNames;
  parameters?: GenericParameters;
  opts?: MallocCallOpts;
}

export interface MallocCallOpts {
  skipFtTransfer?: boolean;
  overrides?: MallocCallOverrides;
}

export type MallocCallActionReturn = (
  parameters?: GenericParameters
) => () => Action<MallocCall>;

// ----------------- Ft Transfer Call Interface
export interface IFtTransferCallToMallocCallAction {
  mallocCallContractID: AccountId;
  tokenIn?: AccountId;
}

export type FtTransferCallToMallocCallActionReturn = (parameters?: {
  tokenIn?: string;
}) => () => Action<FtTransferCallToMallocCall>;

// ------------------------- Construction Interfaces
export interface ActionOutputForConstructionWithParamsFilled {
  [token_id: string]: ActionOrConstructionWithSplitParametersFilled[];
}

export interface ActionOutputForConstruction {
  [token_id: string]: ActionOrConstructionWithSplit[];
}

/**
 * Input to the construction builder.
 *
 * @param in - The input action into the construction
 * @param out - If null, then assume that the action is an endpoint and does not have anything
 * following it. If the output is not null, then it is a map of Token IDs to a list of actions/ constructions
 * and associated splits. Each token ID should correspond to a returned token from the input Action
 */
export interface IConstruction {
  in:
    | ReturnType<MallocCallActionReturn>
    | ReturnType<FtTransferCallToMallocCallActionReturn>;
  out: null | ActionOutputForConstruction;
  parameterNames?: ParameterNames;
}

export type ConstructionReturn = (
  parameters?: GenericParameters
) => () => _InternalConstruction;

// ---- Compile Construction Args
export interface ICompileConstruction {
  startingConstructionOrActions: ActionOrConstructionWithSplit[];
  parameters?: GenericParameters;
}

export type RunEphemeralInstr = Omit<IRunEphemeralConstruction, "amount">;
