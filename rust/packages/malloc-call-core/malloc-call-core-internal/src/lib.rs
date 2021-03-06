use near_sdk::json_types::ValidAccountId;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{Balance, Gas};
use near_sdk::{json_types::U128, AccountId, Promise};
pub mod ft;
pub mod utils;
pub mod gas;

pub fn call_method_name() -> Vec<u8> {
    "malloc_call".to_string().into_bytes()
}

pub fn resolver_method_name() -> Vec<u8> {
    "resolver".to_string().into_bytes()
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct MallocCallMetadata {
    pub name: String,
    pub gas_required: Gas,
    pub attachment_required: U128,
}

/// The call should return a Vec of ReturnItems
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ReturnItem {
    pub token_id: ValidAccountId,
    pub amount: String,
}

// TODO: implement for calls
pub trait Revert {
    //    fn revert()
}

pub trait MallocCallNoCallback<CallArgs> {
    /// The wrapper function which takes in some amount of tokens which are
    /// defined by token_contract
    fn malloc_call(
        &mut self,
        args: CallArgs,
        amount: String,
        token_id: ValidAccountId,
        caller: ValidAccountId,
    ) -> Vec<ReturnItem>;

    fn metadata(&self) -> MallocCallMetadata;
}

pub trait MallocCallWithCallback<CallArgs, ResolverArgs> {
    /// The wrapper function which takes in some amount of tokens which are
    /// defined by token_contract
    fn malloc_call(
        &mut self,
        args: CallArgs,
        amount: U128,
        token_id: ValidAccountId,
        caller: ValidAccountId,
    );

    fn metadata(&self) -> MallocCallMetadata;

    fn resolver(&self, args: ResolverArgs) -> Vec<ReturnItem>;
}
