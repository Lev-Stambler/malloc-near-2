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

use std::fmt::format;
use std::{string, usize};

use construction::{Construction, ConstructionCall, ConstructionCallId, ConstructionId};
use malloc_call_core::ft::{FungibleTokenBalances, FungibleTokenHandlers};
// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, UnorderedSet, Vector};
use near_sdk::env::{log, predecessor_account_id, random_seed};
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, log, near_bindgen, serde, serde_json, setup_alloc, utils, AccountId, Gas, PanicOnDefault,
    Promise,
};
use node::{Node, NodeCall, NodeCallId, NodeId};
use serde_ext::VectorWrapper;

use crate::errors::Errors;

// mod checker;
mod construction;
pub mod errors;
// mod malloc_utils;
mod node;
// mod node_callback;
mod serde_ext;
// mod storage;
mod test_utils;

setup_alloc!();

// TODO: what these numbers mean
const BASIC_GAS: Gas = 5_000_000_000_000;
// This can be brought down probs?
// This can be brought down probs?
const CALLBACK_GAS: Gas = 5_000_000_000_000 * 5;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct GenericId {
    pub owner: AccountId,
    pub name: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    constructions: UnorderedMap<ConstructionId, Construction>,
    construction_calls: UnorderedMap<ConstructionCallId, ConstructionCall>,
    node_calls: UnorderedMap<NodeCallId, NodeCall>,
    nodes: UnorderedMap<NodeId, Node>,
    balances: FungibleTokenBalances,
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
        // TODO: disable?
        caller: Option<ValidAccountId>,
    );
    fn delete_construction(&mut self, construction_id: ConstructionId);
    fn process_next_node_call(&mut self, construction_call_id: ConstructionCallId);
}

#[near_bindgen]
impl CoreFunctionality for Contract {
    fn delete_construction(&mut self, construction_id: ConstructionId) {
        // self.delete_construction_internal(construction_id, env::predecessor_account_id())
        //     .unwrap_or_else(|e| panic!(e))
    }

    fn register_nodes(&mut self, node_names: Vec<String>, nodes: Vec<Node>) {
        assert_eq!(
            node_names.len(),
            nodes.len(),
            "{}",
            Errors::NUMB_OF_NODES_NOT_EQUAL_TO_NUMB_NAMES
        );

        let owner = Some(env::predecessor_account_id());
        for i in 0..node_names.len() {
            self.nodes
                .insert(&NodeId::new(node_names[i].clone(), owner.clone()), &nodes[i]);
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
        caller: Option<ValidAccountId>,
    ) {
        let caller = if let Some(caller) = caller {
            caller.into()
        } else {
            env::predecessor_account_id()
        };

        let construction = self
            .get_construction(&construction_id)
            .unwrap_or_else(|e| panic!(e));

        let initial_amounts = Construction::get_split_amounts(amount.into(), initial_splits);

        let init_node_calls = NodeCall::node_calls_from_construction_indices(
            self,
            initial_node_indices,
            initial_amounts,
        )
        .unwrap_or_else(|e| panic!(e));

        let node_call_ids_prefix = format!("{}-nodes", construction_call_id);
        let node_call_ids =
            VectorWrapper::from_vec(init_node_calls, node_call_ids_prefix.as_bytes());

        let construction_call = ConstructionCall::new(
            &self,
            caller,
            construction_id,
            &construction_call_id,
            node_call_ids,
        )
        .unwrap_or_else(|e| panic!(e));

        self.construction_calls
            .insert(&construction_call_id, &construction_call);
    }

    // #[payable]
    // fn init(
    //     &mut self,
    //     construction_call_id: ConstructionCallDataId,
    //     construction_id: ConstructionId,
    //     amount: U128,
    //     caller: Option<ValidAccountId>,
    // ) {
    //     // TODO: do we want to let someone else call for you?
    // }
    #[payable]
    fn process_next_node_call(&mut self, construction_call_id: ConstructionCallId) {
        // let mut construction_call = self.get_construction_call_unchecked(&construction_call_id);
        // assert_eq!(construction_call.caller, env::predecessor_account_id());
        // let ret_prom = self._run_step(construction_call_id);
        // env::promise_return(ret_prom);
    }
}

#[near_bindgen]
impl Contract {
    pub fn get_construction_call_unchecked(&self, id: &ConstructionCallId) -> ConstructionCall {
        self.construction_calls
            .get(&id)
            .unwrap_or_else(|| panic!(Errors::CONSTRUCTION_NOT_FOUND))
    }
}

// #[near_bindgen]
// impl Contract {
//     // TODO: clean up
//     #[private]
//     #[payable]
//     pub fn handle_node_callback(
//         &mut self,
//         construction_call_id: ConstructionCallId,
//         splitter_call_id: SplitterCallId,
//         splitter_idx: u64,
//         node_idx: u64,
//         caller: AccountId,
//     ) -> Option<u64> {
//         self.handle_node_callback_internal(
//             construction_call_id,
//             splitter_call_id,
//             splitter_idx,
//             node_idx,
//             caller,
//         )
//     }
// }

/// ************ Fungible Token handlers ***************************
#[near_bindgen]
impl FungibleTokenHandlers for Contract {
    #[payable]
    fn ft_on_transfer(&mut self, sender_id: String, amount: String, msg: String) -> String {
        self.balances.ft_on_transfer(sender_id, amount, msg)
    }

    fn get_ft_balance(&self, account_id: AccountId, token_id: AccountId) -> U128 {
        U128::from(self.balances.get_ft_balance(&account_id, &token_id))
    }

    #[private]
    fn subtract_ft_balance(&mut self, account_id: AccountId, token_id: AccountId) {
        self.balances
            .subtract_contract_bal_from_user(&account_id, token_id)
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

impl GenericId {
    pub fn new(name: String, owner: Option<AccountId>) -> ConstructionId {
        ConstructionId {
            name,
            owner: owner.unwrap_or(env::predecessor_account_id()),
        }
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    const INIT_ACCOUNT_BAL: u128 = 10_000;

    use core::time;
    use std::thread;

    use super::*;
    use near_sdk::json_types::ValidAccountId;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;
    use near_sdk::MockedBlockchain;

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
    fn test_simple_transfers_success() {
        // let mut context = get_context(accounts(0));
        // testing_env!(context.build());
        // let splitter = SerializedSplitter {
        //     children: vec![
        //         Node::SimpleTransfer {
        //             recipient: accounts(1).to_string(),
        //         },
        //         Node::SimpleTransfer {
        //             recipient: accounts(2).to_string(),
        //         },
        //     ],
        //     splits: vec![100, 100],
        //     ft_contract_id: None,
        // };
        // let mut contract = Contract::new();
        // testing_env!(context
        //     .storage_usage(env::storage_usage())
        //     .attached_deposit(110) // give a little extra for transfers
        //     .predecessor_account_id(accounts(0))
        //     .build());
        // let init_bal = env::account_balance();
        // let prom = contract.run_ephemeral(splitter, U128::from(100));
    }
}
