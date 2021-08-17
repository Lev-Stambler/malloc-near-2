import {
  AccountId,
  FtTransferCallToMallocCall,
  MallocCall,
  Action,
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
} from "./interfaces";

export const MallocCallAction = <T>(
  input: IMallocCallAction
): MallocCallActionReturn => {
  return (parameters?: GenericParameters) => {
    return () => {
      throw "TODO";
    };
  };
};
export const FtTransferCallToMallocCallAction = <T>(
  input: IFtTransferCallToMallocCallAction
): FtTransferCallToMallocCallActionReturn => {
  return () => {
    return () => {
      throw "TODO";
    };
  };
};

export const Construction = (input: IConstruction): ConstructionReturn => {
  return (parameters?: GenericParameters) => {
    return () => {
      throw "TODO";
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