use near_sdk::{AccountId, json_types::{U128, ValidAccountId}, serde::{self, Deserialize, Serialize}};

// From https://github.com/ref-finance/ref-contracts/blob/main/ref-exchange/src/action.rs#L8
/// Single swap action.
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SwapAction {
    /// Pool which should be used for swapping.
    pub pool_id: u64,
    /// Token to swap from.
    pub token_in: AccountId,
    /// Amount to exchange.
    /// If amount_in is None, it will take amount_out from previous step.
    /// Will fail if amount_in is None on the first step.
    pub amount_in: Option<U128>,
    /// Token to swap into.
    pub token_out: AccountId,
    /// Required minimum amount of token_out.
    pub min_amount_out: U128,
}

/// Single action. Allows to execute sequence of various actions initiated by an account.
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
#[serde(untagged)]
pub enum Action {
    Swap(SwapAction),
}

// From https://github.com/ref-finance/ref-contracts/blob/main/ref-exchange/src/token_receiver.rs
/// Message parameters to receive via token function call.
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
#[serde(untagged)]
pub enum TokenReceiverMessage {
    /// Alternative to deposit + execute actions call.
    Execute {
        referral_id: Option<ValidAccountId>,
        /// If force != 0, doesn't require user to even have account. In case of failure to deposit to the user's outgoing balance, tokens will be returned to the exchange and can be "saved" via governance.
        /// If force == 0, the account for this user still have been registered. If deposit of outgoing tokens will fail, it will deposit it back into the account.
        force: u8,
        /// List of sequential actions.
        actions: Vec<Action>,
    },
}