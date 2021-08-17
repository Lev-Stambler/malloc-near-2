use std::{u64, usize};

// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use malloc_call_core::MallocCallFT;
use malloc_call_core::gas::MALLOC_CALL_DEFAULT_GAS;
use malloc_call_core::{self, ft::FungibleTokenHandlers, MallocCallWithCallback, ReturnItem};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::env::predecessor_account_id;
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::json;
use near_sdk::{
    env, ext_contract, log, near_bindgen, serde, setup_alloc, AccountId, Balance, Gas,
    PanicOnDefault, Promise, PromiseId,
};

setup_alloc!();

const BASIC_GAS: Gas = 5_000_000_000_000;
const BASIC_RESOLVER_GAS: Gas = 1_000_000_000_000;

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PassThroughArgs {
    log_message: String,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ResolverArgs {
    token_id: ValidAccountId,
    amount: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault, MallocCallFT)]
pub struct Contract {
    balances: malloc_call_core::ft::FungibleTokenBalances,
}

#[near_bindgen]
impl MallocCallWithCallback<PassThroughArgs, ResolverArgs> for Contract {
    fn metadata(&self) -> malloc_call_core::MallocCallMetadata {
        malloc_call_core::MallocCallMetadata {
            gas_required: MALLOC_CALL_DEFAULT_GAS,
            attachment_required: U128(1),
            name: "Send Fungible Tokens".to_string(),
        }
    }

    fn resolver(&self, args: ResolverArgs) -> Vec<ReturnItem> {
        vec![ReturnItem {
            token_id: args.token_id,
            amount: args.amount,
        }]
    }

    #[payable]
    fn malloc_call(
        &mut self,
        args: PassThroughArgs,
        amount: U128,
        token_id: ValidAccountId,
        caller: ValidAccountId,
    ) {
        log!("Log from the passthrough: {}", args.log_message);
        let token_id: AccountId = token_id.into();
        let ret_args = json!({
            "args": {
                "token_id": token_id,
                "amount": amount
            }
        });
        let caller: AccountId = caller.into();
        // Send the money back to malloc contract
        let transfer_prom = self
            .balances
            .internal_ft_transfer_call(&token_id, env::predecessor_account_id(), amount, caller, None);
        // TODO: needs to chec that the transfer was successful
        let ret_prom = env::promise_then(
            transfer_prom,
            env::current_account_id(),
            &malloc_call_core::resolver_method_name(),
            ret_args.to_string().as_bytes(),
            0,
            BASIC_RESOLVER_GAS,
        );
        env::promise_return(ret_prom);
    }
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Contract {
            balances: malloc_call_core::utils::new_balances(),
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
    fn test_blackwhole() {
        todo!();
    }
}
