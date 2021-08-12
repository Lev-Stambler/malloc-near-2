use core::panic;
use std::str::FromStr;

use malloc_call_core::ReturnItem;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::Gas;
use near_sdk::{
    bs58::alphabet::Error,
    env, log,
    serde_json::{self, json},
    AccountId, Promise,
};

use crate::errors::MallocError;
use crate::{
    errors::Errors, serde_ext::VectorWrapper, Construction, ConstructionCall, ConstructionCallId,
    ConstructionId, Contract, GenericId, BASIC_GAS, CALLBACK_GAS,
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
pub struct NodeCall {
    node_index_in_construction: u64,
    block_index: u64,
    amount: u128,
    /// The length of children_status should always equal the length of the splitter's children
    status: NodeCallStatus,
}

pub type NodeCallId = u64;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub enum Node {
    MallocCall {
        // TODO: expected_number_inputs
        check_callback: Option<bool>,
        malloc_call_id: AccountId,
        token_id: AccountId,
        json_args: String,
        gas: Gas,
        attached_amount: U128,
    },
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
    ) -> Result<Vec<NodeCallId>, MallocError> {
        if node_indices.len() != amounts.len() {
            return Err(Errors::NUMB_NODES_DNE_NUMB_SPLITS.to_string());
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
            .unwrap_or_else(|| panic!(Errors::CONSTRUCTION_CALL_SPLITTER_STACK_EMPTY));
        let node_call_id = construction_call.node_calls.0.get(node_call_index).unwrap();
        let mut node_call = self
            .node_calls
            .get(&node_call_id)
            .unwrap_or_else(|| panic!(Errors::NODE_CALL_NOT_FOUND));

        //     // You can panic here as it is expected that _run_step is not called on a callback
        //     // TODO: how can this be enforced?
        let construction = self
            .get_construction(&construction_call.construction_id)
            .unwrap_or_else(|e| panic!(&e));

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
            .unwrap_or_else(|e| panic!(&e));
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
        match self {
            Node::MallocCall {
                malloc_call_id,
                token_id,
                json_args,
                attached_amount,
                check_callback,
                gas,
            } => {
                // TODO: we need a smart way of doing gas for these wcalls...
                // Maybe each could have metadata or something
                // TODO: seperate fn
                let token_contract_id = token_id.clone();
                let call_data = format!(
                    "{{\"args\": {}, \"amount\": \"{}\", \"token_id\": \"{}\", \"caller\": \"{}\"}}",
                    json_args,
                    node_call.amount.to_string(),
                    token_contract_id.clone(),
                    caller
                );

                log!("Node call amount: {}", node_call.amount);

                // TODO: is this wrong???
                let call_prom = if node_call.amount > 0 {
                    // self.balances.subtract_contract_bal_from_user(caller, token_contract_id.clone(), amount);
                    // TODO: what if the ft_transfer prom fails???
                    // TODO: the malloc call (next on the line) has to check that the prior promise resolved
                    let transfer_call_prom = contract.balances.internal_ft_transfer_call(
                        &token_id,
                        malloc_call_id.clone(),
                        node_call.amount.to_string(),
                        caller.clone(),
                        None,
                    );

                    let call_prom = env::promise_then(
                        transfer_call_prom,
                        malloc_call_id.to_string(),
                        &malloc_call_core::call_method_name(),
                        call_data.as_bytes(),
                        (*attached_amount).into(),
                        *gas,
                    );
                    call_prom
                } else {
                    let call_prom = env::promise_batch_create(malloc_call_id);
                    env::promise_batch_action_function_call(
                        call_prom,
                        &malloc_call_core::call_method_name(),
                        call_data.as_bytes(),
                        (*attached_amount).into(),
                        *gas,
                    );
                    call_prom
                };

                // If check callback is false, finish the call and return
                if let Some(check_cb) = check_callback {
                    if !*check_cb {
                        return Ok((call_prom, node_call));
                    }
                }

                let callback = env::promise_batch_then(call_prom, env::current_account_id());
                let callback_args = json!({
                    "construction_call_id": construction_call_id,
                "node_call_id": node_call_id,
                "caller": caller});
                env::promise_batch_action_function_call(
                    callback,
                    b"handle_node_callback",
                    callback_args.to_string().as_bytes(),
                    0,
                    CALLBACK_GAS,
                );
                Ok((callback, node_call))
            }
        }
    }
}

impl NodeCall {
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
            log!("Pushing a node_call with index into construction node calls of {}", node_call.node_index_in_construction);
            construction_call
                .next_node_calls_stack
                .0
                .push(&construction_call.node_calls.0.len());
            construction_call.node_calls.0.push(&node_call_id);
        }
        construction_call
    }
}
