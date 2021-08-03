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
use near_sdk::env::predecessor_account_id;
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::json;
use near_sdk::{env, near_bindgen, serde, setup_alloc, AccountId, Gas, PanicOnDefault, Promise};

use crate::errors::{throw_err, Errors};

pub mod errors;
pub mod ft;
mod serializer;
mod splitter;

setup_alloc!();

const BASIC_GAS: Gas = 5_000_000_000_000;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum SerializedNode {
    // SimpleTransfer {
    //     recipient: AccountId,
    // },
    // FTTransfer {
    //     recipient: AccountId,
    // },
    MallocCall {
        contract_id: AccountId,
        json_args: String,
        gas: Gas,
        attached_amount: U128,
        next_spitters: Vec<usize>,
    },
}

#[derive(BorshDeserialize, BorshSerialize)]
pub enum Node {
    // SimpleTransfer {
    //     recipient: AccountId,
    // },
    // FTTransfer {
    //     recipient: AccountId,
    // },
    MallocCall {
        contract_id: AccountId,
        json_args: String,
        gas: Gas,
        attached_amount: U128,
        next_spitters: Vector<usize>,
    },
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Splitter {
    children: Vector<Node>,
    splits: Vector<u128>,
    owner: AccountId,
    split_sum: u128,
    ft_contract_id: AccountId,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SerializedSplitter {
    children: Vec<SerializedNode>,
    splits: Vec<u128>,
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
    splitters: UnorderedMap<AccountId, Vector<Splitter>>,
    account_id_to_ft_balances: UnorderedMap<AccountId, Vec<AccountBalance>>,
}

pub trait SplitterTrait {
    // fn run(&self, account_id: AccountId, splitter_idx: usize);
    fn run_ephemeral(&mut self, splitter: SerializedSplitter, amount: U128) -> Promise;
    // fn store(&mut self, splitter: SerializedSplitter, owner: AccountId);
}

#[near_bindgen]
impl SplitterTrait for Contract {
    #[payable]
    fn run_ephemeral(&mut self, splitter: SerializedSplitter, amount: U128) -> Promise {
        let deserialized = self.deserialize(splitter, true);
        // TODO: make it so its not j attached deposit but via an NEP4 contract
        let (prom, _) = self._run(deserialized, amount.into());
        prom.then(Promise::new(env::predecessor_account_id()))
            .as_return()
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
