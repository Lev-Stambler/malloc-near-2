import {
  AccountId,
  Construction,
  FtTransferCallToMallocCall,
  InitConstructionArgs,
  MallocCall,
  Action,
  WithdrawFromMallocCall,
  ActionTypesLibraryFacing,
  MallocClient,
  SpecialAccountType,
  SpecialAccount,
  IRunEphemeralConstruction,
} from "@malloc/sdk";
import { _InternalConstruction } from "./internal/construction-internal";

// ---------------- Base interface

export interface ActionOrConstructionWithSplitParametersFilledLazy {
  element:
    | ReturnType<MallocCallActionReturn>
    | ReturnType<FtTransferCallToMallocCallActionReturn>
    | ReturnType<WithdrawFromMallocCallReturn>
    | ReturnType<ConstructionReturn>;
  // If a string is used, assume that a parameter is being used for the fraction
  fraction: number;
}

export interface ActionOrConstructionWithSplitParametersFilled {
  element:
    | ReturnType<ReturnType<MallocCallActionReturn>>
    | ReturnType<ReturnType<FtTransferCallToMallocCallActionReturn>>
    | ReturnType<ReturnType<WithdrawFromMallocCallReturn>>
    | ReturnType<ReturnType<ConstructionReturn>>;
  // If a string is used, assume that a parameter is being used for the fraction
  fraction: number | string;
}

export interface ActionOrConstructionWithSplit {
  element:
    | ReturnType<MallocCallActionReturn>
    | ReturnType<FtTransferCallToMallocCallActionReturn>
    | ReturnType<WithdrawFromMallocCallReturn>
    | ReturnType<ConstructionReturn>;
  fraction: number | string | BindedParameter;
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

// ----------------- Malloc Call Action Interfaces

interface MallocCallOverrides {
  checkCallback?: boolean;
  gasForCall?: number;
  attachedAmount?: number;
}

export interface IMallocCallAction {
  mallocCallContractID: AccountId;
  prefilledParameters?: GenericParameters;
  parameters?: GenericParameters;
  opts?: MallocCallOpts;
  callArgNames: string[];
}

export interface MallocCallOpts {
  skipFtTransfer?: boolean;
  overrides?: MallocCallOverrides;
}

export type MallocCallActionReturn = (
  parameters?: GenericParameters
) => (parametersFromParent?: GenericParameters) => Action<MallocCall>;

// ----------------- Ft Transfer Call Interface
export interface IFtTransferCallToMallocCallAction {
  mallocCallContractID: AccountId;
  tokenIn?: AccountId;
}

export type FtTransferCallToMallocCallActionReturn = (parameters?: {
  tokenIn?: string;
}) => () => Action<FtTransferCallToMallocCall>;

// ------------------ WithdrawFromMallocCall Interface
export interface IWithdrawFromMallocCall {
  mallocCallContractID: AccountId;
  tokenIn?: AccountId;
  recipient?: AccountId;
}

export interface WithdrawFromMallocCallParams {
  tokenIn?: string;
  recipient?: AccountId;
}

export type WithdrawFromMallocCallReturn = (
  parameters?: WithdrawFromMallocCallParams
) => () => Action<WithdrawFromMallocCall>;

// ------------------------- Construction Interfaces
// TODO: we would like to make this token_id be optional here
type _ActionOutputsForConstruction<T, TOKEN_ID> = {
  token_id?: TOKEN_ID;
  next: T[];
}[];

export type ActionOutputsForConstruction = _ActionOutputsForConstruction<
  ActionOrConstructionWithSplit,
  AccountId | BindedParameter
>;
export type ActionOutputsForConstructionWithParamsFilled =
  _ActionOutputsForConstruction<
    ActionOrConstructionWithSplitParametersFilled,
    AccountId
  >;

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
  out: null | ActionOutputsForConstruction;
}

export type ConstructionReturn = (
  parameters?: GenericParameters
) => (parametersFromParent?: GenericParameters) => _InternalConstruction;

// --------------- Compile Interfaces
export interface ICompile {
  initialConstructionOrActions: ActionOrConstructionWithSplitParametersFilledLazy[];
}

export type CompileReturn = (amount: string) => IRunEphemeralConstruction;
