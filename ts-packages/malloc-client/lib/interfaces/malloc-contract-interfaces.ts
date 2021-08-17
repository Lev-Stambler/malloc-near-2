import { Construction } from "./construction-interfaces";
import { Action, ActionTypesContractFacing } from "./action-interfaces";
import { ConstructionCallId, ConstructionId } from "./shared";

export interface InitConstructionArgs {
  construction_call_id: ConstructionCallId;
  construction_id: ConstructionId;
  amount: string;
  initial_action_indices: number[];
  initial_splits: number[];
  next_actions_indices: number[][][];
  next_actions_splits: number[][][];
}

export interface RegisterConstructionArgs {
  construction_name: string;
  construction: Construction;
}

export interface RegisterActionsArgs {
  action_names: string[];
  actions: Action<ActionTypesContractFacing>[];
}

export interface ProcessNextActionCallArgs {
  construction_call_id: ConstructionCallId;
}
