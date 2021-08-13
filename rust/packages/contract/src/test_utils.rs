#[cfg(all(test, not(target_arch = "wasm32")))]
pub mod tests {
    const INIT_ACCOUNT_BAL: u128 = 10_000;
    use malloc_call_core::ReturnItem;
    use near_sdk::{AccountId, borsh::BorshSerialize, collections::Vector, json_types::ValidAccountId, test_utils::{accounts, VMContextBuilder}};

    use crate::serde_ext::VectorWrapper;

    pub(crate) fn return_item_eq(a: &ReturnItem, b: &ReturnItem) -> bool {
        let a_tok_id: AccountId = a.token_id.clone().into();
        let b_tok_id: AccountId = b.token_id.clone().into();
        return a.amount == b.amount && a_tok_id == b_tok_id;
    }

    pub(crate) fn vec_to_vector<T: BorshSerialize>(v: &[T], prefix: &[u8]) -> VectorWrapper<T> {
        let mut vector = Vector::new(prefix);
        for i in v.iter() {
            vector.push(i);
        }
        VectorWrapper(vector)
    }

    // mock the context for testing, notice "signer_account_id" that was accessed above from env::
    pub fn get_context(predecessor_account_id: ValidAccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id)
            .account_balance(INIT_ACCOUNT_BAL);
        builder
    }
}
