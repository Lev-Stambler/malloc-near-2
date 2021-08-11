use std::{string, u64, usize};
use malloc_call_core::ft::FungibleTokenHandlers;

// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use malloc_call_core::{MallocCallWithCallback, ReturnItem, malloc_call};
// use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
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

// See https://github.com/mikedotexe/nep-141-examples/blob/master/basic/src/fungible_token_core.rs
const GAS_FOR_RESOLVE_TRANSFER: Gas = 5_000_000_000_000;
const GAS_FOR_FT_TRANSFER_CALL: Gas = 25_000_000_000_000 + GAS_FOR_RESOLVE_TRANSFER;
const VIEW_GAS: Gas = 1_000_000_000_000;
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
    recipient: Option<AccountId>,
}


#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct NewArgs {
    pub ref_finance: ValidAccountId
}

#[malloc_call]
pub struct Contract {
    pub ref_finance: AccountId,
}

#[ext_contract]
pub trait RefFiContract {
    fn mft_balance_of(&self, token_id: String, account_id: ValidAccountId) -> U128;
}

impl Contract {
    // TODO: get # of tokens and make unregister true
    fn get_withdraw(&mut self, token_out_id: String, amount_out: &str) -> u64 {
        // ref_fi_contract.mft_balance_of(swap_args.token_out, env::current_account_id());
        let withdraw_data = json!({
            "token_id": token_out_id,
            "amount": amount_out,
            "unregister": false,
            "msg": ""
        });
        env::promise_create(
            self.ref_finance.to_owned(),
            "withdraw".as_bytes(),
            withdraw_data.to_string().as_bytes(),
            1,
            WITHDRAW_GAS,
        )
    }

    fn get_register_tokens(&mut self, promise_idx: u64, tokens: &[ValidAccountId]) -> u64 {
        let data = json!({ "token_ids": tokens });
        env::promise_then(
            promise_idx,
            self.ref_finance.clone(),
            "register_tokens".to_string().as_bytes(),
            data.to_string().as_bytes(),
            1,
            BASIC_GAS,
        )
    }

    fn get_transfer(
        &mut self,
        promise_idx: u64,
        receiver_id: &AccountId,
        amount: &str,
        token_contract: &AccountId,
    ) -> u64 {
        let ft_transfer_data = json!({
            "receiver_id": receiver_id,
            "amount": amount,
            "msg": ""
        });
        env::promise_then(
            promise_idx,
            token_contract.to_owned(),
            "ft_transfer".to_string().as_bytes(),
            ft_transfer_data.to_string().as_bytes(),
            1,
            BASIC_GAS,
        )
    }

    fn get_transfer_call(
        &mut self,
        receiver_id: &str,
        amount: &str,
        token_contract: &AccountId,
        caller: &AccountId
    ) -> u64 {
        self.balances.internal_ft_transfer_call(token_contract, receiver_id.to_owned(), amount.to_owned(), caller.to_owned(), None)
        // let ft_transfer_data = json!({
        //     "receiver_id": receiver_id,
        //     "amount": amount,
        //     "msg": ""
        // });
        // let prom = env::promise_batch_create(token_contract.to_owned());
        // env::promise_batch_action_function_call(
        //     prom,
        //     "ft_transfer_call".to_string().as_bytes(),
        //     ft_transfer_data.to_string().as_bytes(),
        //     1,
        //     GAS_FOR_FT_TRANSFER_CALL,
        // );
    }

    fn get_swap(
        &mut self,
        promise_idx: u64,
        amount: &str,
        token_contract: &AccountId,
        swap_args: &RefSwapArgs,
    ) -> u64 {
        let data = json!({
            "actions": vec![json!({
                "pool_id": swap_args.pool_id,
                "token_in": token_contract,
                "token_out": swap_args.token_out,
                "min_amount_out": swap_args.min_amount_out,
                "amount_in": amount
            })]
        });
        env::promise_then(
            promise_idx,
            (&self.ref_finance).to_owned(),
            "swap".to_string().as_bytes(),
            data.to_string().as_bytes(),
            1,
            SWAP_GAS,
        )
    }
}

// TODO: some way to fish out the funds from more than min slippage?

#[near_bindgen]
impl Contract {
    #[private]
    pub fn _resolve_get_amount(
        &mut self,
        token_out_id: ValidAccountId,
        recipient: ValidAccountId,
        #[callback] amount: U128,
    ) -> u64 {
        let amount: u128 = amount.into();
        let amount: String = amount.to_string();
        let token_out_id: AccountId = token_out_id.into();
        log!("Amount {}", amount);
        let withdraw = self.get_withdraw(token_out_id.clone(), &amount);
        log!("A");
        let transfer =
            self.get_transfer(withdraw, &recipient.into(), &amount, &token_out_id);
        log!("A");
        let resolver_args = format!(
            "{{\"amount\": \"{}\", \"token_id\": \"{}\"}}",
            amount, &token_out_id
        );
        let resolver = env::promise_then(
            transfer,
            env::current_account_id(),
            "resolver".as_bytes(),
            resolver_args.as_bytes(),
            0,
            BASIC_GAS,
        );
        env::promise_return(resolver);
        resolver
        // self.resolver(ReturnItem {
        //     token_id,
        //     amount: "0".to_string()
        // })
    }
}

#[near_bindgen]
impl MallocCallWithCallback<RefSwapArgs, ReturnItem, u64> for Contract {
    fn resolver(&self, ret: ReturnItem) -> Vec<malloc_call_core::ReturnItem> {
        vec![ret]
    }

    #[payable]
    fn malloc_call(&mut self, args: RefSwapArgs, amount: String, token_id: ValidAccountId, caller: ValidAccountId) -> u64 {
        let token_id: AccountId = token_id.into();
        // Send the funds back to the Malloc Contract if their is no recipient
        let recipient = args
            .recipient
            .clone()
            .unwrap_or(env::predecessor_account_id());
        let transfer_call = self.get_transfer_call(&self.ref_finance.clone(), &amount, &token_id, &caller.into());
        // TODO: remove regiser
        // let register_tokens = self.get_register_tokens(transfer_call, &args.register_tokens);
        let swap = self.get_swap(transfer_call, &amount, &token_id, &args);

        log!("A");
        let bal_args = json!({
            "token_id": args.token_out,
            "account_id": env::current_account_id()
        });

        log!("A");
        let mft_bal_prom = env::promise_then(swap, self.ref_finance.to_owned(), "mft_balance_of".as_bytes(), bal_args.to_string().as_bytes(), 0, VIEW_GAS);
        let callback = env::promise_batch_then(mft_bal_prom, env::current_account_id());
        log!("A");
        let callback_args = json!({ 
        "token_out_id": &args.token_out,
        "recipient": &recipient});
        log!("Gas used: {}", env::used_gas());
        env::promise_batch_action_function_call(
            callback,
            b"_resolve_get_amount",
            callback_args.to_string().as_bytes(),
            3,
            BASIC_GAS,
        );
        env::promise_return(callback);
        callback
    }

    fn metadata(&self) -> malloc_call_core::MallocCallMetadata {
        malloc_call_core::MallocCallMetadata {
            name: "Ref Dex Swap".to_string(),
            minimum_attached_deposit: Some(15.into()),
            minimum_gas: None,
        }
    }
}

#[near_bindgen]
impl Contract {
    #[init]
    fn new(malloc_contract_id: ValidAccountId, ref_finance: ValidAccountId) -> Self {
        Contract {  
            balances: malloc_call_core::utils::new_balances(),
            malloc_contract_id: malloc_contract_id.into(), 
            ref_finance: ref_finance.into()
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
    fn test_simple_swap() {}
}
