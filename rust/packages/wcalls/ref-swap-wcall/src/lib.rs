use std::{u64, usize};

// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
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
use wcall_core::WCallEndpoint;

setup_alloc!();

// See https://github.com/mikedotexe/nep-141-examples/blob/master/basic/src/fungible_token_core.rs
const GAS_FOR_RESOLVE_TRANSFER: Gas = 5_000_000_000_000;
const GAS_FOR_FT_TRANSFER_CALL: Gas = 25_000_000_000_000 + GAS_FOR_RESOLVE_TRANSFER;
const BASIC_GAS: Gas = 5_000_000_000_000;
const SWAP_GAS: Gas = BASIC_GAS + BASIC_GAS;
const WITHDRAW_GAS: Gas = BASIC_GAS + BASIC_GAS + BASIC_GAS + GAS_FOR_FT_TRANSFER_CALL;

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct RefSwapArgs {
    pool_id: u64,
    token_out: AccountId,
    min_amount_out: String,
    register_tokens: Vec<ValidAccountId>,
    recipient: AccountId,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    ref_finance: AccountId,
}

#[ext_contract]
pub trait RefFiContract {
    fn mft_balance_of(&self, token_id: String, account_id: ValidAccountId) -> U128;
}

impl Contract {
    // TODO: get # of tokens and make unregister true
    fn get_withdraw(&mut self, swap_args: &RefSwapArgs) -> Promise {
        // ref_fi_contract.mft_balance_of(swap_args.token_out, env::current_account_id());
        let withdraw_data = json!({
            "token_id": swap_args.token_out,
            "amount": swap_args.min_amount_out,
            "unregister": false,
            "msg": ""
        });
        Promise::new(self.ref_finance.to_owned()).function_call(
            "withdraw".to_string().into_bytes(),
            withdraw_data.to_string().into_bytes(),
            1,
            WITHDRAW_GAS,
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
            GAS_FOR_FT_TRANSFER_CALL + BASIC_GAS,
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
            SWAP_GAS,
        )
    }
}

#[near_bindgen]
impl WCallEndpoint<RefSwapArgs> for Contract {
    #[payable]
    fn wcall(&mut self, args: RefSwapArgs, amount: String, token_contract: AccountId) -> Promise {
        self.get_transfer_call(self.ref_finance.clone(), &amount, &token_contract)
            .then(self.get_register_tokens(&args.register_tokens))
            .then(self.get_swap(&amount, &token_contract, &args))
            .then(self.get_withdraw(&args))
            .then(self.get_transfer(&args.recipient, &args.min_amount_out, &args.token_out))
    }
    fn metadata(&self) -> wcall_core::WCallEndpointMetadata {
        wcall_core::WCallEndpointMetadata {
            minimum_gas: 
        }
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
