use std::{u64, usize};

// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use malloc_call_core::{MallocCall, ReturnItem};
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

const BASIC_GAS: Gas = 5_000_000_000_000;

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SendArgs {
    recipient: AccountId,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ResolverArgs {}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {}

#[near_bindgen]
impl MallocCall<SendArgs, ResolverArgs> for Contract {
    fn metadata(&self) -> malloc_call_core::MallocCallMetadata {
        malloc_call_core::MallocCallMetadata {
            minimum_gas: None,
            minimum_attached_deposit: Some(1.into()),
            name: "Send Fungible Tokens".to_string(),
        }
    }

    fn resolver(&self, args: ResolverArgs) -> Vec<ReturnItem> {
        vec![]
    }

    #[payable]
    fn call(&mut self, args: SendArgs, amount: String, token_contract: AccountId) -> Promise {
        let json_args = json!({"receiver_id": args.recipient, "amount": amount});
        Promise::new(token_contract)
            .function_call(
                "ft_transfer".to_string().into_bytes(),
                json_args.to_string().into_bytes(),
                1,
                BASIC_GAS,
            )
            .then(Promise::new(env::current_account_id()))
            .function_call(
                malloc_call_core::resolver_method_name(),
                "{}".to_string().into_bytes(),
                0,
                malloc_call_core::BASIC_RESOLVER_GAS,
            )
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
    fn test_simple_send() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let mut contract = Contract::new();
        testing_env!(context
            .storage_usage(env::storage_usage())
            .attached_deposit(110) // give a little extra for transfers
            .predecessor_account_id(accounts(0))
            .build());
    }
}
