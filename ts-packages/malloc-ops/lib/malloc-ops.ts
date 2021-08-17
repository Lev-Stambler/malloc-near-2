import {
  AccountId,
  FtTransferCallToMallocCall,
  MallocCall,
  Node,
} from "@malloc/sdk";
import {
  ConstructionReturn,
  FtTransferCallToMallocCallNodeReturn,
  Group,
  GroupReturn,
  IConstruction,
  IFtTransferCallToMallocCallNode,
  IGrouping,
  IMallocCallNode,
  MallocCallNodeReturn,
  MallocCallOpts,
  Parameters,
} from "./interfaces";

export const MallocCallNode = <T>(
  input: IMallocCallNode
): MallocCallNodeReturn => {
  return async (parameters?: Parameters) => {
    throw "TODO";
  };
};
export const FtTransferCallToMallocCallNode = <T>(
  input: IFtTransferCallToMallocCallNode
): FtTransferCallToMallocCallNodeReturn => {
  return async () => {
    throw "TODO";
  };
};

export const Grouping = (input: IGrouping): GroupReturn => {
  return async (parameters?: Parameters) => {
    throw "TODO";
  };
};

export const Construction = (input: IConstruction): ConstructionReturn => {
  return async (parameters?: Parameters) => {
    throw "TODO";
  };
};
