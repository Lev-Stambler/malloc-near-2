use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{collections::Vector, env, AccountId};

pub type ConstructionCallId = String;

/// A Construction is the collection of nodes. It can be used to form the call DAG
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Construction {
    pub nodes: VectorWrapper<NodeId>,
}

pub type ConstructionId = GenericId;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ConstructionCall {
    pub caller: AccountId,
    pub construction_id: ConstructionId,
    // TODO: ideally we want to have a queue not a stack (so we have BFS not DFS). But, Vector only supports O(1) stack ops.
    // Implementing a custom data structure may later be required
    /// A vector which indexes into the node call vector
    pub next_node_calls_stack: VectorWrapper<u64>,
    pub node_calls: VectorWrapper<NodeCallId>,
}

use crate::GenericId;
use crate::errors::Errors;
use crate::node::NodeId;
use crate::{errors::MallocError, serde_ext::VectorWrapper, Contract, NodeCallId};

impl Construction {
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
        contract: &Contract,
        caller: AccountId,
        construction_id: ConstructionId,
        construction_call_id: &ConstructionCallId,
        node_call_ids: VectorWrapper<NodeCallId>,
    ) -> Result<ConstructionCall, MallocError> {
        // Ensure the construction call id is not already registered
        assert!(
            contract
                .construction_calls
                .get(&construction_call_id)
                .is_none(),
            Errors::CONSTRUCTION_CALL_ID_ALREADY_USED
        );

        let construction = contract.get_construction(&construction_id)?;

        let splitter_index = 0;
        let vect_prefix_str_node_stack = format!("constcall-stack-{}", construction_call_id);
        let vect_prefix_node_call_stack = vect_prefix_str_node_stack.as_bytes();

        let vect_prefix_str_node_call = format!("constcall-{}", construction_call_id.clone());
        let vect_prefix_node_call = vect_prefix_str_node_call.as_bytes();

        let mut node_call_stack = VectorWrapper(Vector::new(vect_prefix_node_call_stack));
        for i in 0..node_call_ids.0.len() {
            node_call_stack.0.push(&i);
        }

        Ok(ConstructionCall {
            caller,
            construction_id,
            node_calls: node_call_ids,
            next_node_calls_stack: node_call_stack,
        })
    }
}

impl Contract {
    pub fn get_construction(&self, id: &ConstructionId) -> Result<Construction, MallocError> {
        self.constructions
            .get(&id)
            .ok_or(Errors::CONSTRUCTION_NOT_FOUND.to_string())
    }
}
