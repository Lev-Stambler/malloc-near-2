import {
  AccountId,
  Construction,
  FtTransferCallToMallocCall,
  InitConstructionArgs,
  IRunEphemeralConstruction,
  MallocCall,
  Node,
  NodeTypes,
} from "@malloc/sdk";

// ---------------- Base interfaces
interface NodeConstructionBase {
  type: "Node" | "Construction";
  tokenIn: AccountId;
}

export interface NodeOrConstructionWithSplit {
  element:
    | ReturnType<MallocCallNodeReturn>
    | ReturnType<FtTransferCallToMallocCallNodeReturn>
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

// ----------------- Malloc Call Node Interfaces

interface MallocCallOverrides {
  checkCallback?: boolean;
  gasForCall?: number;
  attachedAmount?: number;
}

export interface IMallocCallNode {
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

export type MallocCallNodeReturn = (
  parameters?: GenericParameters
) => () => Promise<Node<MallocCall>>;

// ----------------- Ft Transfer Call Interface
export interface IFtTransferCallToMallocCallNode {
  mallocCallContractID: AccountId;
  tokenIn?: AccountId;
}

export type FtTransferCallToMallocCallNodeReturn = (parameters?: {
  tokenIn?: string;
}) => () => Promise<Node<FtTransferCallToMallocCall>>;

// ------------------------- Construction Interfaces
export interface IConstruction {
  in:
    | ReturnType<MallocCallNodeReturn>
    | ReturnType<FtTransferCallToMallocCallNodeReturn>;
  out: {
    [token_id: string]: NodeOrConstructionWithSplit[];
  };
  parameterNames?: ParameterNames;
}

export type ConstructionReturn = (
  parameters?: GenericParameters
) => () => Promise<Construction>;

// ---- Compile Construction Args
export interface ICompileConstruction {
  startingConstructionOrNodes: NodeOrConstructionWithSplit[];
  parameters?: GenericParameters;
}

export type RunEphemeralInstr = Omit<IRunEphemeralConstruction, "amount">;
