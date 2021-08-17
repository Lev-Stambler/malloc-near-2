use crate::malloc_utils::GenericId;
use crate::node::{NextNodesIndicesForNode, NextNodesSplitsForNode, NodeCall, NodeId};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{collections::Vector, env, AccountId};

pub type ConstructionCallId = String;

/// A Construction is the collection of nodes. It can be used to form the call DAG
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Construction {
    pub nodes: VectorWrapper<NodeId>,
}

pub type ConstructionId = GenericId;

pub type NextNodesIndicesForConstruction = VectorWrapper<NextNodesIndicesForNode>;
pub type NextNodesSplitsForConstruction = VectorWrapper<NextNodesSplitsForNode>;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
/// ConstructionCalls contain all the dynamic data when calling a construction
/// They are unique per construction call, so once a user is done calling a construction,
/// They should delete the construction call
pub struct ConstructionCall {
    pub caller: AccountId,
    pub construction_id: ConstructionId,
    // TODO: ideally we want to have a queue not a stack (so we have BFS not DFS). But, Vector only supports O(1) stack ops.
    // See https://github.com/Lev-Stambler/malloc-near-2/issues/16
    /// A vector which indexes into the node call vector
    /// Indicates which node_calls should be called next
    pub next_node_calls_stack: VectorWrapper<u64>,
    /// A vector which contains the node call id's for all the nodes which the
    /// construction call already interacted with (either pushing it onto the stack, executing it, or handling a node's return
    pub node_calls: VectorWrapper<NodeCallId>,

    // TODO: move into separate lookup table with id ref: See https://github.com/Lev-Stambler/malloc-near-2/issues/17
    pub next_nodes_indices_in_construction: NextNodesIndicesForConstruction,
    pub next_nodes_splits: NextNodesSplitsForConstruction,
}

use crate::errors::panic_errors;
use crate::{errors::PanicError, vector_wrapper::VectorWrapper, Contract, NodeCallId};

impl Construction {
    /// Convert a vector of splits and a given amount to a Vec of amount values.
    /// All of the amounts are rounded down, so the sum of the result may be slightly (at most the length of splits)
    /// Smaller than the input amount
    pub fn get_split_amounts(amount: u128, splits: VectorWrapper<u128>) -> Vec<u128> {
        let mut amounts = vec![];

        let mut split_sum = 0;
        for i in 0..splits.0.len() {
            split_sum += splits.0.get(i).unwrap();
        }

        for i in 0..splits.0.len() {
            let frac = (splits.0.get(i).unwrap() as f64) / (split_sum as f64);
            let transfer_amount_float = frac * amount as f64;
            let transfer_amount = transfer_amount_float.floor() as u128;
            amounts.push(transfer_amount);
        }
        amounts
    }
}

impl ConstructionCall {
    /// Creates a new construction call and also places all elements from node_call_ids into the new stack
    pub fn new(
        contract: &mut Contract,
        caller: AccountId,
        construction_id: ConstructionId,
        construction_call_id: &ConstructionCallId,
        amount: u128,
        initial_node_indices: Vec<u64>,
        initial_splits: VectorWrapper<u128>,
        next_nodes_indices: NextNodesIndicesForConstruction,
        next_nodes_splits: NextNodesSplitsForConstruction,
    ) -> Result<ConstructionCall, PanicError> {
        // Ensure the construction call id is not already registered
        assert!(
            contract
                .construction_calls
                .get(&construction_call_id)
                .is_none(),
            "{}",
            panic_errors::CONSTRUCTION_CALL_ID_ALREADY_USED
        );

        // Ensure the construction actually exists
        let _construction = contract.get_construction(&construction_id)?;

        // Create the vectors necessary for the construction call
        let vect_prefix_str_node_stack = format!("constcall-stack-{}", construction_call_id);
        let vect_prefix_node_call_stack = vect_prefix_str_node_stack.as_bytes();

        let initial_amounts = Construction::get_split_amounts(amount, initial_splits);
        let init_node_calls = NodeCall::node_calls_from_construction_indices(
            contract,
            initial_node_indices,
            initial_amounts,
        )
        .unwrap_or_else(|e| panic!("{}", e));

        let node_call_ids_prefix = format!("{}-nodes", construction_call_id);
        let node_call_ids =
            VectorWrapper::from_vec(init_node_calls, node_call_ids_prefix.as_bytes());

        // Create the call stack and push the initial calls onto it
        let mut node_call_stack = VectorWrapper(Vector::new(vect_prefix_node_call_stack));
        for i in 0..node_call_ids.0.len() {
            node_call_stack.0.push(&i);
        }

        Ok(ConstructionCall {
            caller,
            construction_id,
            node_calls: node_call_ids,
            next_node_calls_stack: node_call_stack,
            next_nodes_indices_in_construction: next_nodes_indices,
            next_nodes_splits,
        })
    }
}

impl Contract {
    pub fn get_construction(&self, id: &ConstructionId) -> Result<Construction, PanicError> {
        self.constructions
            .get(&id)
            .ok_or(panic_errors::CONSTRUCTION_NOT_FOUND.to_string())
    }
}
