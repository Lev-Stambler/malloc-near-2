import {
  AccountId,
  FtTransferCallToMallocCall,
  MallocCall,
  Node,
} from "@malloc/sdk";
import {
  ConstructionReturn,
  FtTransferCallToMallocCallNodeReturn,
  IConstruction,
  IFtTransferCallToMallocCallNode,
  IMallocCallNode,
  MallocCallNodeReturn,
  MallocCallOpts,
  NodeOrConstructionWithSplit,
  GenericParameters,
  RunEphemeralInstr,
  ICompileConstruction,
} from "./interfaces";

export const MallocCallNode = <T>(
  input: IMallocCallNode
): MallocCallNodeReturn => {
  return (parameters?: GenericParameters) => {
    return async () => {
      throw "TODO";
    };
  };
};
export const FtTransferCallToMallocCallNode = <T>(
  input: IFtTransferCallToMallocCallNode
): FtTransferCallToMallocCallNodeReturn => {
  return () => {
    return () => {
      throw "TODO";
    };
  };
};

export const Construction = (input: IConstruction): ConstructionReturn => {
  return (parameters?: GenericParameters) => {
    return async () => {
      throw "TODO";
    };
  };
};

export const compileConstruction = async (
  input: ICompileConstruction
): Promise<RunEphemeralInstr> => {
  throw "TODO";
};

export const runEphemeralConstruction = async (
  instruction: RunEphemeralInstr,
  amount: string
): Promise<void> => {
  throw "TODO";
};

