use std::{u64, usize};

// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::env::predecessor_account_id;
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::json;
use near_sdk::{
    env, log, near_bindgen, serde, setup_alloc, AccountId, Gas, PanicOnDefault, Promise,
};

setup_alloc!();

const BASIC_GAS: Gas = 5_000_000_000_000;

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct RefSwapArgs {
    pool_id: u64,
    token_out: AccountId,
    min_amount_out: String,
    register_tokens: Vec<ValidAccountId>,
}

// TODO: its own crate
pub trait WCall<T> {
    fn wcall(
        &mut self,
        args: T,
        amount: String,
        token_contract: AccountId,
        recipient: AccountId,
    ) -> Promise;
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    ref_finance: AccountId,
}

impl Contract {
    fn get_withdraw(&mut self, swap_args: &RefSwapArgs, token_contract: AccountId) -> Promise {
        let ft_transfer_data = json!({
            "token_id": token_contract,
            "amount": swap_args.min_amount_out,
            "unregister": false
        });
        Promise::new(token_contract).function_call(
            "ft_transfer_call".to_string().into_bytes(),
            ft_transfer_data.to_string().into_bytes(),
            1,
            BASIC_GAS,
        )
    }

    fn get_register_tokens(&mut self, tokens: &[ValidAccountId]) -> Promise {
        let data = json!({ "token_ids": tokens });
        Promise::new(self.ref_finance.to_owned()).function_call(
            "register_tokens".to_string().into_bytes(),
            data.to_string().into_bytes(),
            1,
            BASIC_GAS,
        )
    }

    fn get_transfer(
        &mut self,
        receiver_id: &str,
        amount: &str,
        token_contract: &AccountId,
    ) -> Promise {
        let ft_transfer_data = json!({
            "receiver_id": receiver_id,
            "amount": amount,
            "msg": ""
        });
        Promise::new(token_contract.to_owned()).function_call(
            "ft_transfer".to_string().into_bytes(),
            ft_transfer_data.to_string().into_bytes(),
            1,
            BASIC_GAS,
        )
    }

    fn get_transfer_call(
        &mut self,
        receiver_id: String,
        amount: &str,
        token_contract: &AccountId,
    ) -> Promise {
        let ft_transfer_data = json!({
            "receiver_id": receiver_id,
            "amount": amount,
            "msg": ""
        });
        Promise::new(token_contract.to_owned()).function_call(
            "ft_transfer_call".to_string().into_bytes(),
            ft_transfer_data.to_string().into_bytes(),
            1,
            BASIC_GAS,
        )
    }

    fn get_swap(
        &mut self,
        amount: &str,
        token_contract: &AccountId,
        swap_args: &RefSwapArgs,
    ) -> Promise {
        let data = json!({
            "actions": vec![json!({
                "pool_id": swap_args.pool_id,
                "token_in": token_contract,
                "token_out": swap_args.token_out,
                "min_amount_out": swap_args.min_amount_out,
                "amount_in": amount
            })]
        });
        Promise::new((&self.ref_finance).to_owned()).function_call(
            "swap".to_string().into_bytes(),
            data.to_string().into_bytes(),
            1,
            BASIC_GAS,
        )
    }
}

#[near_bindgen]
impl WCall<RefSwapArgs> for Contract {
    #[payable]
    fn wcall(
        &mut self,
        args: RefSwapArgs,
        amount: String,
        token_contract: AccountId,
        recipient: AccountId,
    ) -> Promise {
        //    let swap_prom = Promise::new(self.ref_finance).function_call(method_name, arguments, amount, gas)
        let transfer_into =
            self.get_transfer_call(self.ref_finance.clone(), &amount, &token_contract);
        transfer_into
            .then(self.get_register_tokens(&args.register_tokens))
            .then(self.get_swap(&amount, &token_contract, &args))
            .then(self.get_withdraw(&args, token_contract.clone()))
            .then(self.get_transfer(&recipient, &args.min_amount_out, &args.token_out))
    }
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(ref_finance: AccountId) -> Self {
        Contract { ref_finance }
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
    fn test_simple_swap() {}
}
