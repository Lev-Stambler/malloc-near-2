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

use std::usize;

// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::env::predecessor_account_id;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, serde, setup_alloc, AccountId, PanicOnDefault, Promise};

setup_alloc!();

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub enum Endpoint {
    SimpleTransferLeaf { recipient: AccountId },
    // TODO: make a trade
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Splitter {
    endpoints: Vector<Endpoint>,
    splits: Vector<u128>,
    owner: AccountId,
    split_sum: u128,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SerializedSplitter {
    nodes: Vec<Endpoint>,
    splits: Vec<u128>,
    owner: AccountId,
    split_sum: u128,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    splitters: UnorderedMap<AccountId, Vector<Splitter>>,
}

pub trait SplitterTrait {
    // fn run(&self, account_id: AccountId, splitter_idx: usize);
    fn run_ephemeral(&mut self, splitter: SerializedSplitter) -> Promise;
    // fn store(&mut self, splitter: SerializedSplitter, owner: AccountId);
}

#[near_bindgen]
impl SplitterTrait for Contract {
    #[payable]
    fn run_ephemeral(&mut self, splitter: SerializedSplitter) -> Promise {
        let deserialized = self.deserialize(splitter, true);
        // TODO: make it so its not j attached deposit but via an NEP4 contract
        let (prom, _) = self._run(deserialized, env::attached_deposit());
        prom.then(Promise::new(env::predecessor_account_id()))
            .as_return()
    }
}

impl Contract {
    // This call on _run assumes a well formed splitter
    // Returns a refunded amount
    fn _run(&self, splitter: Splitter, amount: u128) -> (Promise, u128) {
        let numb_endpoints = splitter.endpoints.len();
        if numb_endpoints < 1 {
            panic!("TODO: err");
        }
        let (ret_prom, amount_used) = Contract::handle_splits(&splitter, None, 0, amount, 0);

        if amount_used > amount {
            panic!("TODO:Eerr");
        }
        (ret_prom, amount - amount_used)
    }

    /// handle_splits handles a split by returning a promise for when all the splits are done
    /// handle_splits assumes a well formed splitter, so splitter len > 0, thus the unwrap is ok as
    /// prior_prom should only be null when i = 0
    fn handle_splits(
        splitter: &Splitter,
        prior_prom: Option<Promise>,
        amount_used: u128,
        amount_deposited: u128,
        i: u64,
    ) -> (Promise, u128) {
        if i == splitter.splits.len() {
            return (prior_prom.unwrap(), amount_used);
        }
        let frac = (splitter.splits.get(i).unwrap() as f64) / (splitter.split_sum as f64);
        let transfer_amount_float = frac * amount_deposited as f64;
        let transfer_amount = transfer_amount_float.floor() as u128;
        let prom = Contract::handle_endpoint(transfer_amount, splitter.endpoints.get(i).unwrap());
        // (prom, transfer_amount)
        let next_prom = match prior_prom {
            Some(p) => prom.and(p),
            None => prom,
        };
        Contract::handle_splits(
            splitter,
            Some(next_prom),
            amount_used + transfer_amount,
            amount_deposited,
            i + 1,
        )
    }

    fn handle_endpoint(amount: u128, endpoint: Endpoint) -> Promise {
        match endpoint {
            Endpoint::SimpleTransferLeaf { recipient } => {
                println!("{} {} {}", amount, recipient, predecessor_account_id());
                Promise::new(recipient).transfer(amount)
            }
        }
    }
}

impl Contract {
    pub(crate) fn deserialize(&self, splitter: SerializedSplitter, ephemeral: bool) -> Splitter {
        if !Contract::check_splits(splitter.split_sum, &splitter.splits) {
            panic!("TODO: error handling");
        }
        if splitter.splits.len() != splitter.nodes.len() {
            panic!("TODO: error handling");
        }
        let split_idx = self
            .splitters
            .get(&splitter.owner)
            .map(|vec| vec.len())
            .unwrap_or(0);
        let prefix_base = format!(
            "{}:{}:{}",
            splitter.owner,
            split_idx,
            if ephemeral { "ephemeral" } else { "permanent" }
        );
        let node_prefix = format!("{}-nodes", prefix_base);
        let splits_prefix = format!("{}-splits", prefix_base);
        Splitter {
            split_sum: splitter.split_sum,
            endpoints: Contract::vec_to_vector(splitter.nodes, node_prefix.as_bytes()),
            splits: Contract::vec_to_vector(splitter.splits, splits_prefix.as_bytes()),
            owner: splitter.owner,
        }
    }

    fn check_splits(expected_sum: u128, splits: &[u128]) -> bool {
        let split_sum = splits.iter().fold(0, |acc, x| acc + x);
        if split_sum != expected_sum {
            return false;
        }
        true
    }

    pub(crate) fn vec_to_vector<T: BorshSerialize>(v: Vec<T>, prefix: &[u8]) -> Vector<T> {
        let mut vector = Vector::new(prefix);
        for i in v.iter() {
            vector.push(i);
        }
        vector
    }
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Contract {
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
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let splitter = SerializedSplitter {
            nodes: vec![
                Endpoint::SimpleTransferLeaf {
                    recipient: accounts(1).to_string(),
                },
                Endpoint::SimpleTransferLeaf {
                    recipient: accounts(2).to_string(),
                },
            ],
            splits: vec![100, 100],
            split_sum: 200,
            owner: accounts(0).to_string(),
        };
        let mut contract = Contract::new();
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(100)
            .predecessor_account_id(accounts(0))
            .build());
        let prom = contract.run_ephemeral(splitter);
        let sleep_time = time::Duration::from_millis(10);
        thread::sleep(sleep_time);
        assert_eq!(env::account_balance(), INIT_ACCOUNT_BAL - 100);
    }
}