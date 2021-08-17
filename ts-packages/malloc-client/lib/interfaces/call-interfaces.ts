/********** Call Interfaces ************/

import { AccountId, ConstructionId, ActionCallId } from "./shared";

export interface ActionCallStatus {
  Error?: { message: string };
  // empty enum
  WaitingCall?: any;
  Executing?: { block_index_start: number };
  Success?: any;
}

export interface ActionCall {
  action_index_in_construction: string,
  block_index: string,
  amount: string,
  status: ActionCallStatus
}

export interface ConstructionCall {
  caller: AccountId;
  construction_id: ConstructionId;
  next_action_calls_stack: number[];
  action_calls: ActionCallId[];
}
