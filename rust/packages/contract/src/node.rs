use core::panic;
use std::convert::TryFrom;
use std::str::FromStr;

use malloc_call_core::ft::MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER_CALL;
use malloc_call_core::ReturnItem;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    bs58::alphabet::Error,
    env, log,
    serde_json::{self, json},
    AccountId, Promise,
};
use near_sdk::{utils, Gas};

use crate::errors::PanicError;
use crate::gas::CALLBACK_GAS;
use crate::malloc_utils::GenericId;
use crate::nodes::{self, NodeFunctions};
use crate::{
    errors::panic_errors, vector_wrapper::VectorWrapper, Construction, ConstructionCall,
    ConstructionCallId, ConstructionId, Contract,
};

pub type NodeId = GenericId;

pub type NextNodesIndicesForNode = VectorWrapper<VectorWrapper<u64>>;
pub type NextNodesSplitsForNode = VectorWrapper<VectorWrapper<u128>>;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub enum NodeCallStatus {
    /// The splitter call errored
    Error { message: String },
    /// The splitter call is waiting to be started
    WaitingCall,
    /// The splitter call is currently executing and waiting for a result
    Executing { block_index_start: u64 },
    /// The splitter call succeeded
    Success,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]

// TODO: expected_number_inputs if we make this a dag
// https://github.com/Lev-Stambler/malloc-near-2/issues/26
pub struct NodeCall {
    node_index_in_construction: u64,
    block_index: u64,
    pub amount: u128,
    /// The length of children_status should always equal the length of the splitter's children
    status: NodeCallStatus,
}

pub type NodeCallId = u64;

#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Debug, Clone,
)]
#[serde(crate = "near_sdk::serde")]
pub enum Node {
    // TODO: add ft transfer see https://github.com/Lev-Stambler/malloc-near-2/issues/20
    // FtTransfer {
    //     receiver_id: AccountId,
    //     token_id: AccountId,
    // },
    FtTransferCallToMallocCall(nodes::ft_calls::FtTransferCallToMallocCall),
    MallocCall(nodes::malloc_call::MallocCall),
}

impl Contract {
    /// Increments the next node call id and returns the current one
    fn incr_node_call_id(&mut self) -> NodeCallId {
        let curr = self.next_node_call_id;
        self.next_node_call_id = curr + 1;
        curr
    }
}

impl NodeCall {
    pub fn new_call_id(contract: &mut Contract) -> NodeCallId {
        contract.incr_node_call_id()
    }

    pub fn new(
        contract: &mut Contract,
        amount: u128,
        node_index_in_construction: u64,
    ) -> (NodeCall, NodeCallId) {
        (
            NodeCall {
                amount,
                status: NodeCallStatus::WaitingCall,
                block_index: env::block_index(),
                node_index_in_construction,
            },
            NodeCall::new_call_id(contract),
        )
    }

    pub fn node_calls_from_construction_indices(
        contract: &mut Contract,
        node_indices: Vec<u64>,
        amounts: Vec<u128>,
    ) -> Result<Vec<NodeCallId>, PanicError> {
        if node_indices.len() != amounts.len() {
            return Err(panic_errors::NUMB_NODES_DNE_NUMB_SPLITS.to_string());
        }

        let mut node_calls: Vec<NodeCallId> = Vec::with_capacity(node_indices.len());
        for i in 0..node_indices.len() {
            let (node_call, id) = NodeCall::new(contract, amounts[i], node_indices[i].to_owned());
            contract.node_calls.insert(&id, &node_call);

            node_calls.push(id);
        }

        Ok(node_calls)
    }
}

impl Contract {
    /// This call on _run assumes a well formed splitter
    /// Returns a refunded amount
    pub(crate) fn _run_step(&mut self, construction_call_id: ConstructionCallId) -> u64 {
        let mut construction_call = self.get_construction_call_unchecked(&construction_call_id);

        let node_call_index = construction_call
            .next_node_calls_stack
            .0
            .pop()
            .unwrap_or_else(|| panic!(panic_errors::CONSTRUCTION_CALL_SPLITTER_STACK_EMPTY));
        let node_call_id = construction_call.node_calls.0.get(node_call_index).unwrap();
        let mut node_call = self
            .node_calls
            .get(&node_call_id)
            .unwrap_or_else(|| panic!(panic_errors::NODE_CALL_NOT_FOUND));

        let construction = self
            .get_construction(&construction_call.construction_id)
            .unwrap_or_else(|e| panic!("{}", e));

        let node_index = node_call.node_index_in_construction;
        let node_id = construction.nodes.0.get(node_index).unwrap();

        let mut node = self.nodes.get(&node_id).unwrap();

        self.construction_calls
            .insert(&construction_call_id, &&construction_call);

        let (prom, node_call) = node
            .handle_node(
                self,
                node_call,
                &construction_call_id,
                node_call_id,
                &env::predecessor_account_id(),
            )
            .unwrap_or_else(|e| panic!("{}", e));
        self.node_calls.insert(&node_call_id, &node_call);
        prom
    }
}

impl Node {
    // TODO: split up into helper functions
    // TODO: how to make sure all one input token type for a splitter?
    pub fn handle_node(
        &mut self,
        contract: &mut Contract,
        mut node_call: NodeCall,
        construction_call_id: &ConstructionCallId,
        node_call_id: NodeCallId,
        caller: &AccountId,
    ) -> Result<(u64, NodeCall), String> {
        // Set the child's status in the splitter call
        node_call.status = NodeCallStatus::Executing {
            block_index_start: env::block_index(),
        };
        let prom = match self {
            Node::FtTransferCallToMallocCall(ft_transfer_node) => ft_transfer_node.handle(
                contract,
                &node_call,
                construction_call_id,
                node_call_id,
                caller,
            ),
            Node::MallocCall(call) => call.handle(
                contract,
                &node_call,
                construction_call_id,
                node_call_id,
                caller,
            ),
        };
        let prom_ret = prom?;
        Ok((prom_ret, node_call))
    }
}

impl NodeCall {
    pub(crate) fn get_callback_args(
        construction_call_id: &ConstructionCallId,
        node_call_id: &NodeCallId,
        caller: &AccountId,
        token_return_id: Option<&AccountId>,
    ) -> String {
        let callback_args = match token_return_id {
            None => json!({
                    "construction_call_id": construction_call_id,
                "node_call_id": node_call_id,
                "caller": caller }),
            Some(token_id) => json!({
                    "construction_call_id": construction_call_id,
                "node_call_id": node_call_id,
                "token_return_id": token_id,
                "caller": caller }),
        };
        callback_args.to_string()
    }

    // TODO: error handling
    pub(crate) fn get_results_from_returned_bytes(
        ret_bytes: Vec<u8>,
        token_id: Option<ValidAccountId>,
    ) -> Result<Vec<ReturnItem>, String> {
        let as_u128: Result<String, _> = serde_json::from_slice(&ret_bytes);
        if let Ok(amount_ret) = as_u128 {
            let token_id = token_id.unwrap();
            return Ok(vec![ReturnItem {
                token_id: token_id,
                amount: amount_ret,
            }]);
        };

        let as_return_vec: Result<Vec<ReturnItem>, _> = serde_json::from_slice(&ret_bytes);
        if let Ok(return_vec) = as_return_vec {
            return Ok(return_vec);
        }
        panic!("EXPECTED ONE OF THESE TO WORK")
    }

    pub(crate) fn handle_node_callback_internal(
        &mut self,
        contract: &mut Contract,
        construction_call_id: ConstructionCallId,
        caller: AccountId,
        results: Vec<ReturnItem>,
    ) -> Option<u64> {
        let mut construction_call = contract.get_construction_call_unchecked(&construction_call_id);
        let construction_res = contract.get_construction(&construction_call.construction_id);
        // TODO: error handling with the malloc call cores
        let construction = construction_res.unwrap();

        // // TODO: error handling with the malloc call cores
        // let node_call_res = self.node_calls.get(&node_call_id);
        // let node_call = node_call_res.unwrap();

        // TODO: error handle with malloc call core
        let next_nodes_indices = construction_call
            .next_nodes_indices_in_construction
            .0
            .get(self.node_index_in_construction)
            .unwrap();

        // TODO: error handle with malloc call core
        let next_nodes_splits = construction_call
            .next_nodes_splits
            .0
            .get(self.node_index_in_construction)
            .unwrap();
        if next_nodes_indices.0.len() != next_nodes_splits.0.len() {
            // TODO: error handling with the malloc call cores
            panic!("");
        }

        // TODO: error handle here
        let amounts: Vec<u128> = results
            .iter()
            .map(|r| r.amount.parse::<u128>().unwrap())
            .collect();

        for i in 0..next_nodes_indices.0.len() {
            construction_call = self.handle_next_split_set(
                contract,
                construction_call,
                next_nodes_indices.0.get(i).unwrap(),
                next_nodes_splits.0.get(i).unwrap(),
                amounts[i as usize],
            );
        }
        contract
            .construction_calls
            .insert(&construction_call_id, &construction_call);
        None
    }

    fn handle_next_split_set(
        &mut self,
        contract: &mut Contract,
        mut construction_call: ConstructionCall,
        next_node_indxs: VectorWrapper<u64>,
        next_splits: VectorWrapper<u128>,
        amount: u128,
    ) -> ConstructionCall {
        let next_amounts = Construction::get_split_amounts(amount, next_splits);
        for i in 0..next_amounts.len() {
            let (node_call, node_call_id) = NodeCall::new(
                contract,
                next_amounts[i],
                next_node_indxs.0.get(i as u64).unwrap(),
            );
            contract.node_calls.insert(&node_call_id, &node_call);
            log!(
                "Pushing a node_call with index into construction node calls of {}",
                node_call.node_index_in_construction
            );
            construction_call
                .next_node_calls_stack
                .0
                .push(&construction_call.node_calls.0.len());
            construction_call.node_calls.0.push(&node_call_id);
        }
        construction_call
    }
}

#[cfg(test)]
mod tests {
    use crate::test_utils::tests::return_item_eq;

    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;

    #[test]
    fn test_getting_result_from_bytes_error() {}

    #[test]
    fn test_getting_result_from_bytes() {
        let amount = "10".to_string();
        let token_id = ValidAccountId::try_from("wrap.testnet").unwrap();
        let amount_json = json!(amount.clone());
        let ret_items_json = json!(vec![ReturnItem {
            token_id: token_id.clone(),
            amount: amount.clone()
        },]);
        let from_amount = NodeCall::get_results_from_returned_bytes(
            amount_json.to_string().into_bytes(),
            Some(token_id.clone()),
        )
        .unwrap();

        let from_ret_items = NodeCall::get_results_from_returned_bytes(
            ret_items_json.to_string().into_bytes(),
            None,
        )
        .unwrap();

        assert_eq!(from_ret_items.len(), 1);
        assert_eq!(from_amount.len(), 1);

        assert!(return_item_eq(
            &from_amount[0],
            &ReturnItem { amount, token_id }
        ));
        assert!(return_item_eq(&from_amount[0], &from_ret_items[0]));
    }
}
