use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{json_types::U128, AccountId, Promise};

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct WCallEndpointMetadata {
    pub minimum_gas: Option<U128>,
    pub minimum_attached_deposit: Option<U128>,
}

pub trait WCallEndpoint<T> {
    /// The wrapper function which takes in some amount of tokens which are
    /// defined by token_contract
    fn wcall(&mut self, args: T, amount: String, token_contract: AccountId) -> Promise;

    fn metadata(&self) -> WCallEndpointMetadata;
}

// TODO: make work
pub trait WCallChained<T> {
    fn wcall(
        &mut self,
        args: T,
        amount_in: String,
        token_contract_in: AccountId,
        token_contract_out: AccountId,
    ) -> Promise;
}
