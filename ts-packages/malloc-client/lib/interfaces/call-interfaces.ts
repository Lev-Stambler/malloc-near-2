/********** Call Interfaces ************/

import { AccountId, ConstructionId, NodeCallId } from "./shared";

export interface NodeCallStatus {
  Error?: { message: string };
  // empty enum
  WaitingCall?: any;
  Executing?: { block_index_start: number };
  Success?: any;
}

export interface NodeCall {
  node_index_in_construction: string,
  block_index: string,
  amount: string,
  status: NodeCallStatus
}

export interface ConstructionCall {
  caller: AccountId;
  construction_id: ConstructionId;
  next_node_calls_stack: number[];
  node_calls: NodeCallId[];
}
