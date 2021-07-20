use near_sdk::{AccountId, Promise};

pub struct WCallEndpointMetadata {
    minimum_gas: u128,
    minimum_attached_deposit: u128,
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
