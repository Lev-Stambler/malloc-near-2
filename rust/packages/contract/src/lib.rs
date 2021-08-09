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
use serde_ext::VectorWrapper;

use crate::errors::Errors;

mod checker;
pub mod errors;
mod malloc_utils;
mod serde_ext;
mod splitter;
mod splitter_callback;
mod storage;
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
    owner: AccountId,
    index: u64,
}

pub type SplitterId = GenericId;

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
pub struct SplitterCall {
    splitter_index: u64,
    block_index: u64,
    amount: u128,
    /// The length of children_status should always equal the length of the splitter's children
    children_status: VectorWrapper<NodeCallStatus>,
}

pub type ConstructionCallDataId = String;

pub type SplitterCallId = u64;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ConstructionCallData {
    caller: AccountId,
    construction_id: ConstructionId,
    // TODO: ideally we want to have a queue not a stack (so we have BFS not DFS). But, Vector only supports O(1) stack ops.
    // Implementing a custom data structure may later be required
    /// A vector which indexes into the splitter call vector
    next_splitter_call_stack: VectorWrapper<u64>,
    splitter_calls: VectorWrapper<SplitterCall>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct ConstructionId {
    owner: AccountId,
    name: String,
}

// The indexes into the next splitters from the construction's splitter list
pub type NodeNextSplitters = VectorWrapper<u64>;
pub type SplitterNextSplitters = VectorWrapper<NodeNextSplitters>;
pub type ConstructionNextSplitters = VectorWrapper<SplitterNextSplitters>;

/// A Construction is the collection of splitters and next splitter which form the
/// contract call tree
/// Note: its assumed that the first splitter is the initial starting point
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Construction {
    splitters: VectorWrapper<SplitterId>,
    next_splitters: ConstructionNextSplitters,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub enum Node {
    MallocCall {
        check_callback: Option<bool>,
        contract_id: AccountId,
        json_args: String,
        gas: Gas,
        attached_amount: U128,
    },
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Splitter {
    children: VectorWrapper<Node>,
    splits: VectorWrapper<u128>,
    ft_contract_id: AccountId,
}

#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct AccountBalance {
    contract_id: AccountId,
    balance: u128,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    constructions: UnorderedMap<AccountId, UnorderedMap<String, Construction>>,
    construction_calls: UnorderedMap<ConstructionCallDataId, ConstructionCallData>,
    splitters: UnorderedMap<AccountId, Vector<Splitter>>,
    balances: FungibleTokenBalances,
}

pub trait ConstructionTrait {
    // fn run(&self, account_id: AccountId, splitter_idx: usize);
    fn register_construction(
        &mut self,
        construction_name: String,
        splitters: Vec<Splitter>,
        next_splitters: ConstructionNextSplitters,
    );
    fn start_construction(
        &mut self,
        construction_call_id: ConstructionCallDataId,
        construction_id: ConstructionId,
        amount: U128,
        caller: Option<ValidAccountId>,
    );
    fn delete_construction(&mut self, construction_id: ConstructionId);
}

pub trait SplitterTrait {
    fn process_next_split_call(&mut self, construction_call_id: ConstructionCallDataId);
    // fn store_splitters(&mut self, splitters: Vec<Splitter>, owner: ValidAccountId);
    // fn store_construction(&mut self, construction: Construction);
}

#[near_bindgen]
impl ConstructionTrait for Contract {
    fn delete_construction(&mut self, construction_id: ConstructionId) {
        self.delete_construction_internal(construction_id, env::predecessor_account_id())
            .unwrap_or_else(|e| panic!(e))
    }

    #[payable]
    fn register_construction(
        &mut self,
        construction_name: String,
        splitters: Vec<Splitter>,
        next_splitters: ConstructionNextSplitters,
    ) {
        // env::gas
        let construction = self.create_construction(splitters, next_splitters);
        let construction_id = self.store_construction(construction_name, &construction, None);
        // self._run(construction_id, construction, amount.into());
        // TODO:
        //self.delete_construction(construction_id);
    }

    #[payable]
    fn start_construction(
        &mut self,
        construction_call_id: ConstructionCallDataId,
        construction_id: ConstructionId,
        amount: U128,
        caller: Option<ValidAccountId>,
    ) {
        // TODO: do we want to let someone else call for you?
        let caller = if let Some(caller) = caller {
            caller.into()
        } else {
            env::predecessor_account_id()
        };
        assert!(
            self.construction_calls.get(&construction_call_id).is_none(),
            Errors::CONSTRUCTION_CALL_ID_ALREADY_USED
        );

        let construction_call = self
            .create_construction_call(
                caller,
                construction_id,
                &construction_call_id,
                amount.into(),
            )
            .unwrap_or_else(|e| panic!(e));

        self.construction_calls
            .insert(&construction_call_id, &construction_call);
        let ret_prom = self._run_step(construction_call_id);
        env::promise_return(ret_prom);
    }
}

#[near_bindgen]
impl SplitterTrait for Contract {
    #[payable]
    fn process_next_split_call(&mut self, construction_call_id: ConstructionCallDataId) {
        let mut construction_call = self.get_construction_call_unchecked(&construction_call_id);
        assert_eq!(construction_call.caller, env::predecessor_account_id());
        let ret_prom = self._run_step(construction_call_id);
        env::promise_return(ret_prom);
    }
}

#[near_bindgen]
impl Contract {
    pub fn get_construction_call_unchecked(
        &self,
        id: &ConstructionCallDataId,
    ) -> ConstructionCallData {
        self.construction_calls
            .get(&id)
            .unwrap_or_else(|| panic!(Errors::CONSTRUCTION_NOT_FOUND))
    }
}

#[near_bindgen]
impl Contract {
    // TODO: clean up
    #[private]
    #[payable]
    pub fn handle_node_callback(
        &mut self,
        construction_call_id: ConstructionCallDataId,
        splitter_call_id: SplitterCallId,
        splitter_idx: u64,
        node_idx: u64,
        caller: AccountId,
    ) -> Option<u64> {
        self.handle_node_callback_internal(
            construction_call_id,
            splitter_call_id,
            splitter_idx,
            node_idx,
            caller,
        )
    }
}

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
            splitters: UnorderedMap::new("splitters".as_bytes()),
            constructions: UnorderedMap::new("constructions".as_bytes()),
            construction_calls: UnorderedMap::new("construction-call-stack".as_bytes()),
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
