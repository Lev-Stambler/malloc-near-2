use std::fmt::format;

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};

use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::ValidAccountId;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::json;
use near_sdk::{collections::LookupMap, json_types::U128, AccountId, Balance};
use near_sdk::{env, log, serde_json, Gas, PromiseResult};

// TODO: make lower??
const GAS_BUFFER: Gas = 2_000_000_000_000;
const GAS_FOR_INTERNAL_RESOLVE: Gas = 5_000_000_000_000;
const GAS_FOR_ON_TRANSFER_NEP141: Gas = 5_000_000_000_000;
const GAS_FOR_FT_RESOLVE_TRANSFER_NEP141: Gas = 5_000_000_000_000;
const GAS_FOR_FT_TRANSFER_CALL_NEP141: Gas = GAS_FOR_FT_RESOLVE_TRANSFER_NEP141
    + GAS_FOR_ON_TRANSFER_NEP141
    + 25_000_000_000_000
    + GAS_BUFFER;

pub const MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER_CALL: Gas =
    GAS_FOR_FT_TRANSFER_CALL_NEP141 + GAS_FOR_INTERNAL_RESOLVE + GAS_BUFFER;

const RESOLVE_FT_NAME: &str = "resolve_internal_ft_transfer_call";
const FT_TRANSFER_CALL_METHOD_NAME: &str = "ft_transfer_call";

#[derive(BorshDeserialize, BorshSerialize)]
pub struct FungibleTokenBalances {
    /// AccountID -> Account balance.
    // TODO: does it make more sense to go the other way
    pub account_to_contract_balances: LookupMap<String, Balance>,
}

pub trait FungibleTokenHandlers {
    fn ft_on_transfer(&mut self, sender_id: String, amount: String, msg: String) -> String;
    fn get_ft_balance(&self, account_id: AccountId, token_id: AccountId) -> U128;
    /// A private function
    fn resolve_internal_ft_transfer_call(
        &mut self,
        account_id: AccountId,
        token_id: AccountId,
        amount: U128,
    );
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct OnTransferOpts {
    // The account to log the transfer to
    pub sender_id: AccountId,
}

impl FungibleTokenBalances {
    pub fn new(prefix: &[u8]) -> Self {
        FungibleTokenBalances {
            account_to_contract_balances: LookupMap::new(prefix),
        }
    }

    // TODO:?
    // pub fn ft_transfer_call_with_result(&mut self,

    pub fn get_ft_balance(&self, account_id: &AccountId, token_id: &AccountId) -> Balance {
        let current_amount = self
            .account_to_contract_balances
            .get(&Self::get_balances_key(&account_id, &token_id))
            .unwrap_or(0);
        current_amount
    }

    pub fn ft_on_transfer(
        &mut self,
        ft_transfer_sender_id: String,
        amount: String,
        msg: String,
    ) -> String {
        let opts: OnTransferOpts = if (&msg).len() == 0 {
            OnTransferOpts {
                sender_id: ft_transfer_sender_id.clone().into(),
            }
        } else {
            serde_json::from_str(&msg)
                .unwrap_or_else(|e| panic!("Failed to deserialize transfer opts: {}", e))
        };
        let token_id = env::predecessor_account_id();
        let current_amount = self.get_ft_balance(&opts.sender_id, &token_id);
        let amount = amount.parse::<u128>().unwrap();
        self.account_to_contract_balances.insert(
            &Self::get_balances_key(&opts.sender_id, &token_id),
            &(amount + current_amount),
        );

        "0".to_string()
    }

    pub fn internal_ft_transfer_call_custom(
        &mut self,
        token_id: &AccountId,
        recipient: AccountId,
        amount: U128,
        sender: AccountId,
        prior_promise: Option<u64>,
        custom_message: String,
        amount_near: Balance
    ) -> u64 {
        self._internal_ft_transfer_call(
            token_id,
            recipient,
            amount,
            sender,
            prior_promise,
            Some(custom_message),
            amount_near,
        )
    }

    pub fn internal_ft_transfer_call(
        &mut self,
        token_id: &AccountId,
        recipient: AccountId,
        amount: U128,
        sender: AccountId,
        prior_promise: Option<u64>,
    ) -> u64 {
        self._internal_ft_transfer_call(token_id, recipient, amount, sender, prior_promise, None, 1)
    }

    /// Do an internal transfer and subtract the internal balance for {@param sender}
    ///
    /// If there is a custom message, use that for the ft transfer. If not, use the default On Transfer Message
    fn _internal_ft_transfer_call(
        &mut self,
        token_id: &AccountId,
        recipient: AccountId,
        amount: U128,
        sender: AccountId,
        prior_promise: Option<u64>,
        custom_message: Option<String>,
        amount_near: Balance,
    ) -> u64 {
        let data =
            Self::get_transfer_call_data(recipient, amount.clone(), sender.clone(), custom_message);

        let current_balance = self.get_ft_balance(&sender, &token_id);

        let amount_parsed = amount.0;

        if current_balance < amount_parsed {
            panic!("The callee did not deposit sufficient funds");
        }

        self.account_to_contract_balances.insert(
            &Self::get_balances_key(&sender, &token_id),
            &(current_balance - amount_parsed),
        );

        let ft_transfer_prom = match prior_promise {
            None => {
                let prom_batch = env::promise_batch_create(token_id);
                env::promise_batch_action_function_call(
                    prom_batch,
                    FT_TRANSFER_CALL_METHOD_NAME.as_bytes(),
                    &data,
                amount_near,
                    GAS_FOR_FT_TRANSFER_CALL_NEP141,
                );
                prom_batch
            }
            Some(prior_prom) => env::promise_then(
                prior_prom,
                token_id.to_string(),
                FT_TRANSFER_CALL_METHOD_NAME.as_bytes(),
                &data,
                amount_near,
                GAS_FOR_FT_TRANSFER_CALL_NEP141,
            ),
        };
        let internal_resolve_args =
            json!({"account_id": &sender, "token_id": &token_id, "amount": amount});
        env::promise_then(
            ft_transfer_prom,
            env::current_account_id(),
            RESOLVE_FT_NAME.as_bytes(),
            internal_resolve_args.to_string().as_bytes(),
            0,
            GAS_FOR_INTERNAL_RESOLVE,
        )
    }

    pub fn resolve_internal_ft_transfer_call(
        &mut self,
        account_id: &AccountId,
        token_id: AccountId,
        amount: U128,
    ) {
        let amount: u128 = amount.into();
        if amount == 0 {
            return;
        }

        let current_balance = self.get_ft_balance(account_id, &token_id);
        match near_sdk::utils::promise_result_as_success() {
            None => {
                log!("The FT transfer call failed, redepositing funds");
                self.account_to_contract_balances.insert(
                    &Self::get_balances_key(&account_id, &token_id),
                    &(current_balance + amount),
                );
            }
            Some(data) => {
                // TODO: err handling?
                let amount_used_str: String = serde_json::from_slice(data.as_slice())
                    .unwrap_or_else(|e| {
                        panic!("Failed to deserialize ft_transfer_call result {}", e)
                    });
                let amount_used = amount_used_str
                    .parse::<u128>()
                    .unwrap_or_else(|e| panic!("Failed to parse result with {}", e));
                let amount_unused = amount - amount_used;
                log!("Amount unused {}", amount_unused);
                if amount_unused > 0 {
                    self.account_to_contract_balances.insert(
                        &Self::get_balances_key(&account_id, &token_id),
                        &(current_balance + amount_unused),
                    );
                }
            }
        };
    }

    /********** Helper functions **************/
    fn get_balances_key(account_id: &AccountId, token_id: &AccountId) -> String {
        format!("{}-.-{}", account_id, token_id)
    }

    fn get_transfer_call_data(
        recipient: String,
        amount: U128,
        sender: String,
        custom_message: Option<String>,
    ) -> Vec<u8> {
        if let Some(msg) = custom_message {
            json!({ "receiver_id": recipient, "amount": amount, "msg": msg})
                .to_string()
                .into_bytes()
        } else {
            let on_transfer_opts = OnTransferOpts { sender_id: sender };
            // TODO: unwrapping ok?
            json!({ "receiver_id": recipient, "amount": amount, "msg": serde_json::to_string(&on_transfer_opts).unwrap() })
                .to_string()
                .into_bytes()
        }
    }
}

// TODO:!
#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    const INIT_ACCOUNT_BAL: u128 = 10_000;

    use super::*;

    // TODO: should panic type
    #[test]
    #[should_panic]
    fn test_ft_not_enough_balance() {}

    #[test]
    #[should_panic]
    fn test_ft_not_enough_balance_never_registered() {}

    #[test]
    fn test_ft_adding_balances_and_then_subtracting() {}

    #[test]
    fn test_ft_adding_balances() {}
}
