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

use errors::SplitterCallError;
use ft::FungibleTokenHandlers;
// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, UnorderedSet, Vector};
use near_sdk::env::{log, predecessor_account_id, random_seed};
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, log, near_bindgen, serde, setup_alloc, AccountId, Gas, PanicOnDefault, Promise,
};
use serde_ext::VectorWrapper;

use crate::errors::{throw_err, Errors};

mod checker;
pub mod errors;
pub mod ft;
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
pub struct SplitterCall {
    splitter_index: u64,
    block_index: u64,
    amount: u128,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SplitterCallErrorData {
    splitter_call: SplitterCall,
    error: SplitterCallError,
}

pub type ConstructionCallDataId = String;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ConstructionCallData {
    caller: AccountId,
    construction_id: ConstructionId,
    // TODO: ideally we want to have a queue not a stack (so we have BFS not DFS). But, Vector only supports O(1) stack ops.
    // Implementing a custom data structure may later be required
    next_splitter_call_stack: VectorWrapper<SplitterCall>,
    splitter_call_errors: VectorWrapper<SplitterCallErrorData>,
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

pub trait SplitterTrait {
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
    fn process_next_split_call(&mut self, construction_call_id: ConstructionCallDataId);
    // fn store_splitters(&mut self, splitters: Vec<Splitter>, owner: ValidAccountId);
    // fn store_construction(&mut self, construction: Construction);
}

#[near_bindgen]
impl SplitterTrait for Contract {
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
    fn process_next_split_call(&mut self, construction_call_id: ConstructionCallDataId) {
        let mut construction_call = self.get_construction_call_unchecked(&construction_call_id);
        assert_eq!(construction_call.caller, env::predecessor_account_id());
        self._run_step(construction_call_id);
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
            "TODO:"
        );
        let vect_prefix_str_splitter_call_err =
            format!("constcall-err-{}", construction_call_id.clone());
        let vect_prefix_splitter_call_err = vect_prefix_str_splitter_call_err.as_bytes();

        let vect_prefix_str_splitter_call = format!("constcall-{}", construction_call_id.clone());
        let vect_prefix_splitter_call = vect_prefix_str_splitter_call.as_bytes();
        let mut call_stack = VectorWrapper(Vector::new(vect_prefix_splitter_call));
        let call_elem = SplitterCall {
            splitter_index: 0,
            block_index: env::block_index(),
            amount: amount.into(),
        };
        call_stack.0.push(&call_elem);
        self.construction_calls.insert(
            &construction_call_id,
            &ConstructionCallData {
                caller,
                construction_id: construction_id.clone(),
                next_splitter_call_stack: call_stack,
                // TODO: functionality around this pretty pls. How does one record errors? `\_ (- _ -) _/`
                splitter_call_errors: VectorWrapper(Vector::new(vect_prefix_splitter_call_err)),
            },
        );
        self._run_step(construction_call_id);
    }
}

#[near_bindgen]
impl Contract {
    pub(crate) fn create_construction(
        &mut self,
        splitters: Vec<Splitter>,
        next_splitters: ConstructionNextSplitters,
    ) -> Construction {
        // TODO: checks that the splitters len is next splitters len?
        let mut splitter_ids = VectorWrapper(Vector::new(random_seed()));
        for i in 0..splitters.len() {
            self.check_splitter(&splitters[i]);
            // TODO: make this more efficient by making store_splitters a fn which stores them in bulk
            splitter_ids.0.push(&self.store_splitter(&splitters[i]));
        }
        Construction {
            splitters: splitter_ids,
            next_splitters,
        }
    }

    pub(crate) fn get_splitter_unchecked(&self, id: &SplitterId) -> Splitter {
        self.splitters
            .get(&id.owner)
            .unwrap_or_else(|| panic!("TODO:"))
            .get(id.index)
            .unwrap_or_else(|| panic!("TODO:"))
    }

    // TODO: make into trait and seperate file
    pub fn get_construction_unchecked(&self, id: &ConstructionId) -> Construction {
        self.constructions
            .get(&id.owner)
            .unwrap_or_else(|| panic!("TODO:"))
            .get(&id.name)
            .unwrap_or_else(|| panic!("TODO:"))
    }

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
        splitter_idx: u64,
        node_idx: u64,
        caller: AccountId,
        #[callback] ret: Vec<malloc_call_core::ReturnItem>,
    ) -> Option<u64> {
        let construction_call = self.get_construction_call_unchecked(&construction_call_id);
        let construction = self.get_construction_unchecked(&construction_call.construction_id);

        let next_splitters_idx: VectorWrapper<u64> = construction
            .next_splitters
            .0
            .get(splitter_idx)
            .unwrap()
            .0
            .get(node_idx)
            .unwrap();
        let mut next_splitters: Vec<Splitter> = vec![];
        for i in 0..next_splitters_idx.0.len() {
            let splitter_id = construction
                .splitters
                .0
                .get(next_splitters_idx.0.get(i).unwrap())
                .unwrap();
            next_splitters.push(self.get_splitter_unchecked(&splitter_id));
        }
        self.add_to_splitter_call_stack(
            ret,
            &next_splitters,
            &next_splitters_idx,
            &construction_call_id,
        );
        None

        // self.handle_next_splits(
        //     ret,
        //     &next_splitters,
        //     &next_splitters_idx,
        //     &construction_call_id,
        //     &caller,
        // )
        // match self.handle_into_next_split(ret, &next_splitters, None, 0) {
        //     None => None,
        //     Some(prom_idx) => {
        //         env::promise_return(prom_idx);
        //         Some(prom_idx)
        //     }
        // }
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
