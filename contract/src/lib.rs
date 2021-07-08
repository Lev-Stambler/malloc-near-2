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

// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
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
pub struct State {
    splitters: UnorderedMap<AccountId, Vector<Splitter>>,
}

pub trait SplitterTrait {
    // fn run(&self, account_id: AccountId, splitter_idx: usize);
    fn run_ephemeral(&mut self, splitter: SerializedSplitter);
    // fn store(&mut self, splitter: SerializedSplitter, owner: AccountId);
}

#[near_bindgen]
impl SplitterTrait for State {
    #[payable]
    fn run_ephemeral(&mut self, splitter: SerializedSplitter) {
        let deserialized = self.deserialize(splitter, true);
        // TODO: make it so its not j attached deposit but via an NEP4 contract
        self._run(deserialized, env::attached_deposit());
    }
}

impl State {
    // This call on _run assumes a well formed splitter
    // Returns a refunded amount
    fn _run(&self, splitter: Splitter, amount: u128) -> u128 {
        let numb_endpoints = splitter.endpoints.len();
        let mut amount_used: u128 = 0;
        for i in 0..numb_endpoints {
            let frac = (splitter.splits.get(i).unwrap() as f64) / (splitter.split_sum as f64);
            let transfer_amount_float = frac * amount as f64;
            let transfer_amount = transfer_amount_float.floor() as u128;
            State::handle_endpoint(transfer_amount, splitter.endpoints.get(i).unwrap());
            amount_used += transfer_amount;
        }
        if amount_used > amount {
            panic!("TODO");
        }
        amount - amount_used
    }

    fn handle_endpoint(amount: u128, endpoint: Endpoint) -> Promise {
        match endpoint {
            Endpoint::SimpleTransferLeaf { recipient } => Promise::new(recipient).transfer(amount),
        }
    }
}

impl State {
    pub(crate) fn deserialize(&self, splitter: SerializedSplitter, ephemeral: bool) -> Splitter {
        if !State::check_splits(splitter.split_sum, &splitter.splits) {
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
            endpoints: State::vec_to_vector(splitter.nodes, node_prefix.as_bytes()),
            splits: State::vec_to_vector(splitter.splits, splits_prefix.as_bytes()),
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
impl State {
    #[init]
    pub fn new() -> Self {
        State {
            splitters: UnorderedMap::new("splitters".as_bytes()),
        }
    }
}
