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
interface NodeGroupBase {
  type: "Node" | "Group";
  tokenIn: AccountId;
}

export interface Parameters {
  [parameter: string]: any;
}

export interface NodesWithSplits {
  nodesOrGroup: MallocCallNodeReturn | FtTransferCallToMallocCallNodeReturn | GroupReturn;
  splits: number[];
}


// ----------------- Malloc Call Node Interfaces

export interface IMallocCallNode {
  mallocCallContractID: AccountId;
  tokenIn: AccountId;
  prefilledParamets?: Parameters;
  parameters?: string[];
  expectedTokensOut?: AccountId[];
  opts?: MallocCallOpts;
}

export interface MallocCallOpts {
  skipFtTransfer?: boolean;
  overrides?: MallocCallOverrides;
}

export type MallocCallNodeReturn = (
  parameters?: Parameters
) => Promise<Node<MallocCall>>;

// ----------------- Ft Transfer Call Interface
export interface IFtTransferCallToMallocCallNode {
  mallocCallContractID: AccountId;
  tokenIn: AccountId;
}

export type FtTransferCallToMallocCallNodeReturn = () => Promise<
  Node<FtTransferCallToMallocCall>
>;

// -------------------------- Grouping interfaces
export interface IGrouping {
  inNode: (MallocCallNodeReturn | FtTransferCallToMallocCallNodeReturn)[];
  outNodes: {
    [token_id: string]: NodesWithSplits;
  };
  parameterNames?: string[];
}
interface MallocCallOverrides {
  checkCallback?: boolean;
  gasForCall?: number;
  attachedAmount?: number;
}

export interface Group extends NodeGroupBase {
  type: "Group";
  nodes: Node<NodeTypes>[];
  nextNodeIndices: number[][][];
  nextSplits: number[][][];
}

export type GroupReturn = (parameters?: Parameters) => Promise<Group>

// ------------------------- Construction Interfaces 
export interface IConstruction {
	startingPoints: (MallocCallNodeReturn | FtTransferCallToMallocCallNodeReturn | GroupReturn)[],
	initialSplits: number[]
}

export type ConstructionReturn = (parameters?: Parameters) => Promise<Omit<IRunEphemeralConstruction, "amount">>
