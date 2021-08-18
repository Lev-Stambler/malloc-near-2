use std::fmt::format;
use std::thread::panicking;

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};

use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::ValidAccountId;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::{json, Value};
use near_sdk::{collections::LookupMap, json_types::U128, AccountId, Balance};
use near_sdk::{env, log, serde_json, Gas, Promise, PromiseResult};

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
pub const MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER: Gas =
    GAS_FOR_FT_RESOLVE_TRANSFER_NEP141 + GAS_BUFFER;

pub const MALLOC_CALL_CORE_GAS_FOR_WITHDRAW_WITH_FT_TRANSFER_CALL: Gas =
    MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER_CALL + GAS_BUFFER;
pub const MALLOC_CaLL_CORE_GAS_FOR_WITHDRAW_WITH_FT_TRANSFER: Gas =
    MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER + GAS_BUFFER;

const RESOLVE_FT_NAME: &str = "resolve_internal_ft_transfer_call";
const FT_TRANSFER_CALL_METHOD_NAME: &str = "ft_transfer_call";
const FT_TRANSFER_METHOD_NAME: &str = "ft_transfer";

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub enum TransferType {
    Transfer(),
    TransferCallMalloc(),
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct FungibleTokenBalances {
    /// AccountID -> Account balance.
    // TODO: does it make more sense to go the other way
    pub account_to_contract_balances: LookupMap<String, Balance>,
}

pub trait FungibleTokenHandlers {
    fn ft_on_transfer(&mut self, sender_id: String, amount: String, msg: String) -> String;
    fn get_ft_balance(&self, account_id: ValidAccountId, token_id: ValidAccountId) -> U128;
    /// A private contract function which resolves the ft transfer by updating the amount used in the balances
    /// @returns the amount used
    fn resolve_internal_ft_transfer_call(
        &mut self,
        account_id: ValidAccountId,
        token_id: ValidAccountId,
        amount: U128,
    ) -> U128;
    fn withdraw_to(
        &mut self,
        account_id: ValidAccountId,
        amount: U128,
        token_id: ValidAccountId,
        recipient: Option<ValidAccountId>,
        msg: Option<String>,
        transfer_type: TransferType,
    );
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct OnTransferOpts {
    // The account to log the transfer to
    pub sender_id: AccountId,
}

impl TransferType {
    fn to_value(&self) -> Result<Value, serde_json::error::Error> {
        serde_json::to_value(self)
    }
}

impl FungibleTokenBalances {
    pub fn new(prefix: &[u8]) -> Self {
        FungibleTokenBalances {
            account_to_contract_balances: LookupMap::new(prefix),
        }
    }

    pub fn get_withdraw_to_args(
        account_id: &AccountId,
        amount: U128,
        token_id: &AccountId,
        recipient: &AccountId,
        msg: Option<String>,
        transfer_type: TransferType,
    ) -> Result<String, serde_json::error::Error> {
        let ret = json!({
            "account_id": account_id,
            "amount": amount,
            "token_id": token_id,
            "recipient": recipient,
            "msg": msg,
            "transfer_type": transfer_type.to_value()?
        });
        Ok(ret.to_string())
    }

    pub fn withdraw_to(
        &mut self,
        account_id: AccountId,
        amount: u128,
        token_id: AccountId,
        recipient: Option<AccountId>,
        msg: Option<String>,
        transfer_type: TransferType,
        malloc_contract_id: &AccountId,
    ) {
        let caller = env::predecessor_account_id();
        if account_id != caller || malloc_contract_id != &caller {
            panic!("Only the malloc contract or the fund's owner can call withdraw");
        }

        let prom = match transfer_type {
            TransferType::Transfer() => self.internal_ft_transfer(
                &token_id,
                recipient.unwrap_or(caller),
                U128(amount),
                account_id,
                msg,
                None,
            ),
            TransferType::TransferCallMalloc() => self.internal_ft_transfer_call(
                &token_id,
                recipient.unwrap_or(caller),
                U128(amount),
                account_id,
                None,
            ),
        };
        env::promise_return(prom);
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

    pub fn internal_ft_transfer(
        &mut self,
        token_id: &AccountId,
        recipient: AccountId,
        amount: U128,
        sender: AccountId,
        msg: Option<String>,
        prior_promise: Option<u64>,
    ) -> u64 {
        let data = Self::get_transfer_data(recipient, amount.clone(), sender.clone(), msg);

        self.subtract_balance(&sender, token_id, amount.0);

        let ft_transfer_prom = match prior_promise {
            None => {
                let prom = env::promise_batch_create(token_id);
                env::promise_batch_action_function_call(
                    prom,
                    FT_TRANSFER_METHOD_NAME.as_bytes(),
                    &data,
                    1,
                    GAS_FOR_FT_TRANSFER_CALL_NEP141,
                );
                prom
            }
            Some(prior_prom) => env::promise_then(
                prior_prom,
                token_id.to_string(),
                FT_TRANSFER_METHOD_NAME.as_bytes(),
                &data,
                1,
                GAS_FOR_FT_TRANSFER_CALL_NEP141,
            ),
        };
        let internal_resolve_args =
            Self::get_internal_resolve_data(&sender, token_id, amount, TransferType::Transfer())
                .unwrap();
        env::promise_then(
            ft_transfer_prom,
            env::current_account_id(),
            RESOLVE_FT_NAME.as_bytes(),
            internal_resolve_args.to_string().as_bytes(),
            0,
            GAS_FOR_INTERNAL_RESOLVE,
        )
    }

    pub fn internal_ft_transfer_call_custom(
        &mut self,
        token_id: &AccountId,
        recipient: AccountId,
        amount: U128,
        sender: AccountId,
        prior_promise: Option<u64>,
        custom_message: String,
        amount_near: Balance,
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

        let amount_parsed = amount.0;

        self.subtract_balance(&sender, token_id, amount_parsed);

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

    /// Resolve the ft transfer by updating the amount used in the balances
    /// @returns the amount used
    pub fn resolve_internal_ft_transfer_call(
        &mut self,
        account_id: &AccountId,
        token_id: AccountId,
        amount: U128,
    ) -> U128 {
        let amount: u128 = amount.into();
        if amount == 0 {
            return U128(0);
        }

        let current_balance = self.get_ft_balance(account_id, &token_id);
        match near_sdk::utils::promise_result_as_success() {
            None => {
                log!("The FT transfer call failed, redepositing funds");
                self.account_to_contract_balances.insert(
                    &Self::get_balances_key(&account_id, &token_id),
                    &(current_balance + amount),
                );
                U128(0)
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
                U128(amount_used)
            }
        }
    }

    /********** Helper functions **************/
    fn subtract_balance(&mut self, sender: &AccountId, token_id: &AccountId, amount: u128) {
        let current_balance = self.get_ft_balance(sender, token_id);

        if current_balance < amount {
            panic!("The callee did not deposit sufficient funds");
        }

        self.account_to_contract_balances.insert(
            &Self::get_balances_key(sender, token_id),
            &(current_balance - amount),
        );
    }

    fn get_balances_key(account_id: &AccountId, token_id: &AccountId) -> String {
        format!("{}-.-{}", account_id, token_id)
    }

    fn get_internal_resolve_data(
        sender: &AccountId,
        token_id: &AccountId,
        amount: U128,
        transfer_type: TransferType,
    ) -> Result<String, serde_json::error::Error> {
        let internal_resolve_args = json!({"account_id": sender, "token_id": token_id, "amount": amount, "transfer_type": transfer_type.to_value()?});
        Ok(internal_resolve_args.to_string())
    }

    fn get_transfer_data(
        recipient: AccountId,
        amount: U128,
        sender: AccountId,
        custom_message: Option<String>,
    ) -> Vec<u8> {
        if let Some(msg) = custom_message {
            json!({"receiver_id": recipient, "amount": amount, "msg": msg})
                .to_string()
                .into_bytes()
        } else {
            json!({"receiver_id": recipient, "amount": amount})
                .to_string()
                .into_bytes()
        }
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
