use near_sdk::{AccountId, env, serde};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct GenericId {
    pub owner: AccountId,
    pub name: String,
}

impl GenericId {
    pub fn new(name: String, owner: Option<AccountId>) -> GenericId {
        GenericId {
            name,
            owner: owner.unwrap_or(env::predecessor_account_id()),
        }
    }
}
