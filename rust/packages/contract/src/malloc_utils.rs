use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, serde, AccountId};
use uint::construct_uint;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Debug)]
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

construct_uint! {
    /// 256-bit unsigned integer.
    pub struct U256(4);
}


