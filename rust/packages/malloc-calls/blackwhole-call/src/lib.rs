use std::{u64, usize};

// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use malloc_call_core::{MallocCallNoCallback, MallocCallWithCallback, ReturnItem};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::env::predecessor_account_id;
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::json;
use near_sdk::{
    env, ext_contract, log, near_bindgen, serde, setup_alloc, AccountId, Gas, PanicOnDefault,
    Promise,
};

setup_alloc!();

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct BlackWholeArgs {
    log_message: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {}

#[near_bindgen]
impl MallocCallNoCallback<BlackWholeArgs> for Contract {
    fn metadata(&self) -> malloc_call_core::MallocCallWithCallbackMetadata {
        malloc_call_core::MallocCallWithCallbackMetadata {
            minimum_gas: None,
            minimum_attached_deposit: Some(1.into()),
            name: "Send Fungible Tokens".to_string(),
        }
    }

    #[payable]
    fn call(
        &mut self,
        args: BlackWholeArgs,
        amount: String,
        token_contract: AccountId,
    ) -> Vec<ReturnItem> {
        log!("Log from the blackwhole: {}", args.log_message);
        vec![]
    }
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Contract {}
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
    fn test_blackwhole() {
        todo!();
    }
}
