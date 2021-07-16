use near_sdk::{Promise, AccountId};

pub trait WCall<T> {
    /// The wrapper function which takes in some amount of tokens which are
    /// defined by token_contract
    fn wcall(
        &mut self,
        args: T,
        amount: String,
        token_contract: AccountId,
    ) -> Promise;
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

