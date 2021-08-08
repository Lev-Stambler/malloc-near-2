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

use ft::FungibleTokenHandlers;
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
pub mod ft;
mod handle_construction;
mod serde_ext;
mod splitter;
mod storage;
mod test_utils;

setup_alloc!();

const BASIC_GAS: Gas = 5_000_000_000_000;
const CALLBACK_GAS: Gas = 5_000_000_000_000 * 10;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct GenericId {
    owner: AccountId,
    index: u64,
}

pub type SplitterId = GenericId;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub enum SplitterCallStatus {
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
    status: SplitterCallStatus,
}

pub type ConstructionCallDataId = String;

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
    account_id_to_ft_balances: UnorderedMap<AccountId, Vec<AccountBalance>>,
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
        let caller = if let Some(caller) = caller {
            caller.into()
        } else {
            env::predecessor_account_id()
        };
        assert!(
            self.construction_calls.get(&construction_call_id).is_none(),
            Errors::CONSTRUCTION_CALL_ID_NOT_FOUND
        );
        let vect_prefix_str_splitter_stack =
            format!("constcall-stack-{}", construction_call_id.clone());
        let vect_prefix_splitter_call_stack = vect_prefix_str_splitter_stack.as_bytes();

        let vect_prefix_str_splitter_call = format!("constcall-{}", construction_call_id.clone());
        let vect_prefix_splitter_call = vect_prefix_str_splitter_call.as_bytes();

        let mut splitter_calls = VectorWrapper(Vector::new(vect_prefix_splitter_call));
        let call_elem = SplitterCall {
            splitter_index: 0,
            block_index: env::block_index(),
            amount: amount.into(),
            status: SplitterCallStatus::WaitingCall,
        };
        splitter_calls.0.push(&call_elem);

        let mut splitter_call_stack = VectorWrapper(Vector::new(vect_prefix_splitter_call_stack));
        // Add the first element (and only) in splitter calls to the call stack
        splitter_call_stack.0.push(&0);

        self.construction_calls.insert(
            &construction_call_id,
            &ConstructionCallData {
                caller,
                construction_id: construction_id.clone(),
                splitter_calls,
                next_splitter_call_stack: splitter_call_stack,
            },
        );
        self._run_step(construction_call_id);
    }
}

#[near_bindgen]
impl SplitterTrait for Contract {
    #[payable]
    fn process_next_split_call(&mut self, construction_call_id: ConstructionCallDataId) {
        let mut construction_call = self.get_construction_call_unchecked(&construction_call_id);
        assert_eq!(construction_call.caller, env::predecessor_account_id());
        self._run_step(construction_call_id);
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
            .unwrap_or_else(|| panic!("TODO:"))
    }
}

#[near_bindgen]
impl Contract {
    #[private]
    #[payable]
    pub fn handle_node_callback(
        &mut self,
        construction_call_id: ConstructionCallDataId,
        splitter_call_id: u64,
        splitter_idx: u64,
        node_idx: u64,
        caller: AccountId,
        // #[callback] ret: Vec<malloc_call_core::ReturnItem>,
    ) -> Option<u64> {
        let mut construction_call = self.get_construction_call_unchecked(&construction_call_id);
        let construction_res = self.get_construction(&construction_call.construction_id);
        let construction = handle_not_found!(
            self,
            construction_res,
            construction_call_id,
            splitter_call_id,
            construction_call
        );

        let next_splitter_set_res = construction
            .next_splitters
            .0
            .get(splitter_idx)
            .ok_or(Errors::NEXT_SPLITTER_SET_NOT_FOUND_PER_SPLITTER.to_string());

        let next_splitter_set = handle_not_found!(
            self,
            next_splitter_set_res,
            construction_call_id,
            splitter_call_id,
            construction_call
        );

        // The set of next splitters indexes to be called after the called splitter's (referenced by splitter_idx) child (referenced by node_idx) completes.
        let next_splitters_idx_res = next_splitter_set
            .0
            .get(node_idx)
            .ok_or(Errors::NEXT_SPLITTER_SET_NOT_FOUND_PER_SPLITTER.to_string());
        let next_splitters_idx = handle_not_found!(
            self,
            next_splitters_idx_res,
            construction_call_id,
            splitter_call_id,
            construction_call
        );

        // The set of next splitters to be called after the called splitter's (referenced by splitter_idx) child (referenced by node_idx) completes.
        let mut next_splitters: Vec<Splitter> = vec![];
        for i in 0..next_splitters_idx.0.len() {
            let splitter_id_res = construction
                .splitters
                .0
                .get(next_splitters_idx.0.get(i).unwrap()) // You can unwrap safely here as you know that i is from 0 to next_splitter_idx.len
                .ok_or(Errors::SPLITTER_NOT_FOUND_IN_CONSTRUCTION.to_string());

            let splitter_id = handle_not_found!(
                self,
                splitter_id_res,
                construction_call_id,
                splitter_call_id,
                construction_call
            );

            let splitter_res = self.get_splitter(&splitter_id);
            let splitter = handle_not_found!(
                self,
                splitter_res,
                construction_call_id,
                splitter_call_id,
                construction_call
            );

            next_splitters.push(splitter);
        }

        let ret = utils::promise_result_as_success();
        let mut construction_call = match ret {
            // The callback errored
            None => Self::resolve_splitter_call(
                construction_call,
                SplitterCallStatus::Error {
                    message: Errors::MALLOC_CALL_FAILED.to_string(),
                },
                splitter_call_id,
            ),
            Some(ret_serial) => {
                let ret: Result<Vec<malloc_call_core::ReturnItem>, near_sdk::serde_json::Error> =
                    serde_json::from_slice(&ret_serial);

                match ret {
                    Ok(ret) => {
                        // Set the splitter call to successful
                        let mut construction_call = Self::resolve_splitter_call(
                            construction_call,
                            SplitterCallStatus::Success,
                            splitter_call_id,
                        );

                        // Add the next set of splitters to the call stack so that Malloc Client knows
                        // what to call next
                        Self::add_to_splitter_call_stack(
                            construction_call,
                            ret,
                            &next_splitters,
                            &next_splitters_idx,
                            splitter_call_id,
                        )
                    }
                    Err(e) => Self::resolve_splitter_call(
                        construction_call,
                        SplitterCallStatus::Error {
                            message: format!("Error deserializing result: {}", e),
                        },
                        splitter_call_id,
                    ),
                }
            }
        };
        self.construction_calls
            .insert(&construction_call_id, &construction_call);
        None
    }
}

/// ************ Fungible Token handlers ***************************
#[near_bindgen]
impl FungibleTokenHandlers for Contract {
    #[payable]
    fn ft_on_transfer(&mut self, sender_id: String, amount: String, msg: String) -> String {
        let mut balances = self
            .account_id_to_ft_balances
            .get(&sender_id)
            .unwrap_or(Vec::new());
        let contract_id = env::predecessor_account_id();
        let bal_pos = Self::balance_pos(&balances, &contract_id);

        let amount = amount.parse::<u128>().unwrap();
        match bal_pos {
            Some(pos) => {
                balances[pos].balance += amount;
            }
            None => {
                balances.push(AccountBalance {
                    contract_id: env::predecessor_account_id(),
                    balance: amount,
                });
            }
        };
        self.account_id_to_ft_balances.insert(&sender_id, &balances);
        "0".to_string()
    }

    fn get_ft_balance(&self, account_id: AccountId, contract_id: AccountId) -> U128 {
        if let Some(balances) = self.account_id_to_ft_balances.get(&account_id) {
            println!(
                "{} {:?} {}",
                contract_id,
                balances.len(),
                Self::balance_pos(&balances, &contract_id).is_none()
            );
            if let Some(pos) = Self::balance_pos(&balances, &contract_id) {
                U128::from(balances[pos].balance)
            } else {
                U128::from(0)
            }
        } else {
            U128::from(0)
        }
    }
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Contract {
            account_id_to_ft_balances: UnorderedMap::new("account_id_to_ft_balance".as_bytes()),
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
