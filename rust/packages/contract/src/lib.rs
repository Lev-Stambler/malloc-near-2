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
use near_sdk::{
    env, log, near_bindgen, serde, setup_alloc, AccountId, Gas, PanicOnDefault, Promise,
};

use crate::errors::{throw_err, Errors};

pub mod errors;
pub mod ft;
mod serializer;

setup_alloc!();

const BASIC_GAS: Gas = 5_000_000_000_000;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub enum Endpoint {
    SimpleTransfer {
        recipient: AccountId,
    },
    FTTransfer {
        recipient: AccountId,
    },
    WCall {
        contract_id: AccountId,
        json_args: String,
        gas: Gas,
        attached_amount: U128,
    },
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Splitter {
    endpoints: Vector<Endpoint>,
    splits: Vector<u128>,
    owner: AccountId,
    split_sum: u128,
    ft_contract_id: Option<AccountId>,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SerializedSplitter {
    nodes: Vec<Endpoint>,
    splits: Vec<u128>,
    ft_contract_id: Option<AccountId>,
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
    fn ft_on_transfer(&mut self, sender_id: String, amount: String, msg: String) {
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

/// ************ Core Splitter handlers ***************************
impl Contract {
    // This call on _run assumes a well formed splitter
    // Returns a refunded amount
    fn _run(&mut self, splitter: Splitter, amount: u128) -> (Promise, u128) {
        let numb_endpoints = splitter.endpoints.len();
        if numb_endpoints < 1 {
            throw_err(Errors::NoEndpointsSpecified);
        }
        let (ret_prom, amount_used) = self.handle_splits(&splitter, None, 0, amount, 0);

        if amount_used > amount {
            throw_err(Errors::MoreUsedThanAllowed);
        }
        (ret_prom, amount - amount_used)
    }

    /// handle_splits handles a split by returning a promise for when all the splits are done
    /// handle_splits assumes a well formed splitter, so splitter len > 0, thus the unwrap is ok as
    /// prior_prom should only be null when i = 0
    fn handle_splits(
        &mut self,
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
        log!(
            "transferring {} rounded from {}",
            transfer_amount,
            transfer_amount_float
        );
        let prom = self.handle_endpoint(
            transfer_amount,
            splitter.endpoints.get(i).unwrap(),
            &splitter.ft_contract_id,
        );
        let next_prom = match prior_prom {
            Some(p) => prom.and(p),
            None => prom,
        };
        self.handle_splits(
            splitter,
            Some(next_prom),
            amount_used + transfer_amount,
            amount_deposited,
            i + 1,
        )
    }

    // TODO: how to make sure all one input token type for a splitter?
    fn handle_endpoint(
        &mut self,
        amount: u128,
        endpoint: Endpoint,
        token_contract_id: &Option<AccountId>,
    ) -> Promise {
        match endpoint {
            Endpoint::SimpleTransfer { recipient } => Promise::new(recipient).transfer(amount),
            Endpoint::FTTransfer { recipient } => {
                let ft_transfer_method_name = "ft_transfer".to_string().into_bytes();
                let transfer_data = Self::get_transfer_data(recipient, amount.to_string());

                self.subtract_contract_bal_from_user(
                    env::predecessor_account_id(),
                    token_contract_id.clone().unwrap(),
                    amount,
                );
                Promise::new(token_contract_id.clone().unwrap()).function_call(
                    ft_transfer_method_name,
                    transfer_data,
                    1,
                    BASIC_GAS,
                )
            }
            Endpoint::WCall {
                contract_id,
                json_args,
                attached_amount,
                gas,
            } => {
                // TODO: we need a smart way of doing gas for these wcalls...
                // Maybe each could have metadata or something
                let ft_transfer_method_name = "ft_transfer".to_string().into_bytes();
                let token_contract_id = token_contract_id.clone().unwrap();
                let transfer_data =
                    Self::get_transfer_data(contract_id.clone(), amount.to_string());
                let wcall_data = format!(
                    "{{\"args\": {}, \"amount\": \"{}\", \"token_contract\": \"{}\"}}",
                    json_args,
                    amount.to_string(),
                    token_contract_id.clone()
                );
                self.subtract_contract_bal_from_user(
                    env::predecessor_account_id(),
                    token_contract_id.clone(),
                    amount,
                );
                Promise::new(token_contract_id)
                    .function_call(ft_transfer_method_name, transfer_data, 1, BASIC_GAS)
                    .then(Promise::new(contract_id).function_call(
                        "wcall".to_string().into_bytes(),
                        wcall_data.into_bytes(),
                        attached_amount.into(),
                        gas,
                    ))
            }
        }
    }
}

/// ******************** Helper handlers ****************
impl Contract {
    fn get_transfer_data(recipient: String, amount: String) -> Vec<u8> {
        json!({ "receiver_id": recipient, "amount": amount, "msg": ""})
            .to_string()
            .into_bytes()
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
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let splitter = SerializedSplitter {
            nodes: vec![
                Endpoint::SimpleTransfer {
                    recipient: accounts(1).to_string(),
                },
                Endpoint::SimpleTransfer {
                    recipient: accounts(2).to_string(),
                },
            ],
            splits: vec![100, 100],
            ft_contract_id: None,
        };
        let mut contract = Contract::new();
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(110) // give a little extra for transfers
            .predecessor_account_id(accounts(0))
            .build());
        let init_bal = env::account_balance();
        let prom = contract.run_ephemeral(splitter, U128::from(100));
    }
}
