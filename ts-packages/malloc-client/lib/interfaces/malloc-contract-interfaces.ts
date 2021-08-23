import { Construction } from "./construction-interfaces";
import { Action, ActionTypesContractFacing } from "./action-interfaces";
import { ConstructionCallId, ConstructionId, TransferType } from "./shared";

export interface InitConstructionArgs {
  construction_call_id: ConstructionCallId;
  construction_id: ConstructionId;
  amount: string;
  initial_action_indices: number[];
  initial_splits: string[];
  next_actions_indices: number[][][];
  next_actions_splits: string[][][];
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

export interface WithdrawToArgs {
  account_id: string,
  amount: string,
  token_id: string,
  recipient?: string,
  msg?: string,
  transfer_type: TransferType
}