/*
 * This is an example of a Rust smart contract with two simple, symmetric functions:
 *
 * 1. set_greeting: accepts a greeting, such as "howdy", and records it for the user (account_id)
 *    who sent the request
 * 2. get_greeting: accepts an account_id and returns the greeting saved for it, defaulting to
 *    "Hello"
 *
 * Learn more about writing NEAR smart contracts with Rust:
 * https://github.com/near/near-sdk-rs
 *
 */

use construction::{
    Construction, ConstructionCall, ConstructionCallId, ConstructionId,
    NextNodesIndicesForConstruction, NextNodesSplitsForConstruction,
};
use malloc_call_core::ft::{FungibleTokenBalances, FungibleTokenHandlers};
use malloc_call_core::{GasUsage, MallocCallFT, ReturnItem};
// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::{ValidAccountId, U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, log, near_bindgen, serde, serde_json, setup_alloc, utils, AccountId, Gas, PanicOnDefault,
};
use node::{Node, NodeCall, NodeCallId, NodeId};
use serde_ext::VectorWrapper;

use crate::errors::panic_errors;

mod construction;
pub mod errors;
mod gas;
mod malloc_utils;
mod node;
mod nodes;
mod serde_ext;
mod test_utils;

setup_alloc!();
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault, MallocCallFT)]
/// The Contract's state
pub struct Contract {
    /// A store for all the constructions. Constructions are meant to be immutable objects
    // TODO: enforce immutability: https://github.com/Lev-Stambler/malloc-near-2/issues/18
    constructions: UnorderedMap<ConstructionId, Construction>,
    /// A store of all the construction calls. Construction calls are mutable and ephemeral objects
    /// They should only live as long as a single call to a construction
    construction_calls: UnorderedMap<ConstructionCallId, ConstructionCall>,
    /// A store of all the node calls. Node calls are mutable and ephemeral objects
    /// They should only live as long as a single call to a construction. They get deleted
    /// When a construction call gets deleted
    node_calls: UnorderedMap<NodeCallId, NodeCall>,
    /// A store for all the nodes. Nodes are meant to be immutable objects
    // TODO: enforce immutability: https://github.com/Lev-Stambler/malloc-near-2/issues/18
    nodes: UnorderedMap<NodeId, Node>,
    /// Balances keeps track of all the users' balances. See malloc-call-core's documentation for more information
    balances: FungibleTokenBalances,
    /// Keeps track of the next node call id so that node call id's can all be unique and need not be supplied by the caller
    next_node_call_id: NodeCallId,
}

pub trait CoreFunctionality {
    fn register_nodes(&mut self, node_names: Vec<String>, nodes: Vec<Node>);
    fn register_construction(&mut self, construction_name: String, construction: Construction);
    fn init_construction(
        &mut self,
        construction_call_id: ConstructionCallId,
        construction_id: ConstructionId,
        amount: U128,
        initial_node_indices: Vec<u64>,
        initial_splits: VectorWrapper<u128>,
        next_nodes_indices: NextNodesIndicesForConstruction,
        next_nodes_splits: NextNodesSplitsForConstruction,
    );
    fn delete_construction(&mut self, construction_id: ConstructionId);
    fn process_next_node_call(&mut self, construction_call_id: ConstructionCallId);
}

#[near_bindgen]
impl CoreFunctionality for Contract {
    fn delete_construction(&mut self, construction_id: ConstructionId) {
        todo!();
        // self.delete_construction_internal(construction_id, env::predecessor_account_id())
        //     .unwrap_or_else(|e| panic!(e))
    }

    fn register_nodes(&mut self, node_names: Vec<String>, nodes: Vec<Node>) {
        assert_eq!(
            node_names.len(),
            nodes.len(),
            "{}",
            panic_errors::NUMB_OF_NODES_NOT_EQUAL_TO_NUMB_NAMES
        );

        let owner = Some(env::predecessor_account_id());
        for i in 0..node_names.len() {
            self.nodes.insert(
                &NodeId::new(node_names[i].clone(), owner.clone()),
                &nodes[i],
            );
        }
    }

    #[payable]
    fn register_construction(&mut self, construction_name: String, construction: Construction) {
        self.constructions
            .insert(&ConstructionId::new(construction_name, None), &construction);
    }

    fn init_construction(
        &mut self,
        construction_call_id: ConstructionCallId,
        construction_id: ConstructionId,
        amount: U128,
        initial_node_indices: Vec<u64>,
        initial_splits: VectorWrapper<u128>,
        next_nodes_indices: NextNodesIndicesForConstruction,
        next_nodes_splits: NextNodesSplitsForConstruction,
    ) {
        let caller = env::predecessor_account_id();

        let construction = self
            .get_construction(&construction_id)
            .unwrap_or_else(|e| panic!(e));

        let construction_call = ConstructionCall::new(
            self,
            caller,
            construction_id,
            &construction_call_id,
            amount.into(),
            initial_node_indices,
            initial_splits,
            next_nodes_indices,
            next_nodes_splits,
        )
        .unwrap_or_else(|e| panic!(e));

        self.construction_calls
            .insert(&construction_call_id, &construction_call);
    }

    #[payable]
    fn process_next_node_call(&mut self, construction_call_id: ConstructionCallId) {
        self._run_step(construction_call_id);
        log!("Gas used: {}", env::used_gas());
    }
}

#[near_bindgen]
impl Contract {
    pub fn get_node_call_unchecked(&self, id: U64) -> NodeCall {
        self.node_calls.get(&id.into()).unwrap()
    }

    pub fn get_construction_call_unchecked(&self, id: &ConstructionCallId) -> ConstructionCall {
        self.construction_calls
            .get(&id)
            .unwrap_or_else(|| panic!(panic_errors::CONSTRUCTION_NOT_FOUND))
    }
}

#[near_bindgen]
impl GasUsage for Contract {
    fn get_gas_usage(&self) -> Gas {
        75_000_000_000_000
    }
}

#[near_bindgen]
impl Contract {
    #[private]
    #[payable]
    pub fn handle_node_callback(
        &mut self,
        construction_call_id: ConstructionCallId,
        node_call_id: u64,
        caller: AccountId,
        token_return_id: Option<ValidAccountId>,
    ) -> Option<u64> {
        // TODO: err handle!!
        let mut node_call = self.node_calls.get(&node_call_id).unwrap();
        let ret_bytes = match utils::promise_result_as_success() {
            None => panic!("TODO:"),
            Some(bytes) => bytes,
        };
        let results: Vec<ReturnItem> =
            NodeCall::get_results_from_returned_bytes(ret_bytes, token_return_id).unwrap();
        node_call.handle_node_callback_internal(self, construction_call_id, caller, results)
    }
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Contract {
            balances: FungibleTokenBalances::new("malloc-ft".as_bytes()),
            node_calls: UnorderedMap::<NodeCallId, NodeCall>::new("nodecalls".as_bytes()),
            nodes: UnorderedMap::new("nodes".as_bytes()),
            next_node_call_id: 0,
            constructions: UnorderedMap::new("constructions".as_bytes()),
            construction_calls: UnorderedMap::new("construction-call-stack".as_bytes()),
        }
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    const INIT_ACCOUNT_BAL: u128 = 10_000;

    use super::*;
    use near_sdk::json_types::ValidAccountId;
    use near_sdk::test_utils::{accounts, VMContextBuilder};

    // mock the context for testing, notice "signer_account_id" that was accessed above from env::
    fn get_context(predecessor_account_id: ValidAccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id)
            .account_balance(INIT_ACCOUNT_BAL);
        builder
    }

    #[test]
    fn test_simple_transfers_success() {}
}
