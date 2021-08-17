import { Construction } from "./construction-interfaces";
import { Node, NodeTypes } from "./node-interfaces";
import { ConstructionCallId, ConstructionId } from "./shared";

export interface InitConstructionArgs {
  construction_call_id: ConstructionCallId;
  construction_id: ConstructionId;
  amount: string;
  initial_node_indices: number[];
  initial_splits: number[];
  next_nodes_indices: number[][][];
  next_nodes_splits: number[][][];
}

export interface RegisterConstructionArgs {
  construction_name: string;
  construction: Construction;
}

export interface RegisterNodesArgs {
  node_names: string[];
  nodes: Node<NodeTypes>[];
}

export interface ProcessNextNodeCallArgs {
  construction_call_id: ConstructionCallId;
}
