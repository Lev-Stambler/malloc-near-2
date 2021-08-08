use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};

use near_sdk::collections::UnorderedMap;
use near_sdk::env;
use near_sdk::{collections::LookupMap, json_types::U128, AccountId, Balance};

use crate::{errors::Errors, AccountBalance, Contract};

#[derive(BorshDeserialize, BorshSerialize)]
pub struct FungibleTokenBalances {
    /// AccountID -> Account balance.
    // TODO: does it make more sense to go the other way
    pub account_to_contract_balances: UnorderedMap<AccountId, LookupMap<AccountId, Balance>>,
}

pub trait FungibleTokenHandlers {
    fn ft_on_transfer(&mut self, sender_id: String, amount: String, msg: String) -> String;
    fn get_ft_balance(&self, account_id: AccountId, contract_id: AccountId) -> U128;
}

impl FungibleTokenBalances {
    pub(crate) fn new(prefix: &[u8]) -> Self {
        FungibleTokenBalances {
            account_to_contract_balances: UnorderedMap::new(prefix),
        }
    }

    pub(crate) fn get_ft_balance(&self, account_id: &AccountId, token_id: &AccountId) -> Balance {
        let mut balances = self.account_to_contract_balances.get(&account_id);
        match balances {
            None => 0,
            Some(bals) => bals.get(&token_id).unwrap_or(0),
        }
    }

    pub(crate) fn ft_on_transfer(
        &mut self,
        sender_id: String,
        amount: String,
        msg: String,
    ) -> String {
        let mut balances = self
            .account_to_contract_balances
            .get(&sender_id)
            .unwrap_or(LookupMap::new(format!("{}-ft-bals", sender_id).as_bytes()));
        let token_id = env::predecessor_account_id();

        let amount = amount.parse::<u128>().unwrap();
        let current_amount = self.get_ft_balance(&sender_id, &token_id);
        balances.insert(&token_id, &(amount + current_amount));

        self.account_to_contract_balances
            .insert(&sender_id, &balances);
        "0".to_string()
    }

    pub(crate) fn subtract_contract_bal_from_user(
        &mut self,
        account_id: &AccountId,
        token_id: AccountId,
        amount: u128,
    ) {
        if amount == 0 {
            return;
        }

        let current_balance = self.get_ft_balance(account_id, &token_id);

        if current_balance < amount {
            panic!("The callee did not deposit sufficient funds");
        }

        let mut balances = self.account_to_contract_balances.get(account_id).unwrap();
        balances.insert(&token_id, &(current_balance - amount));
        self.account_to_contract_balances
            .insert(&account_id, &balances);
    }
}

// #[cfg(all(test, not(target_arch = "wasm32")))]
// mod tests {
//     const INIT_ACCOUNT_BAL: u128 = 10_000;

//     use crate::{Node, SerializedNode, SerializedSplitter, SplitterTrait};

//     use super::*;
//     use near_sdk::json_types::{ValidAccountId, U128};
//     use near_sdk::test_utils::{accounts, VMContextBuilder};
//     use near_sdk::testing_env;
//     use near_sdk::MockedBlockchain;

//     // mock the context for testing, notice "signer_account_id" that was accessed above from env::
//     fn get_context(predecessor_account_id: ValidAccountId) -> VMContextBuilder {
//         let mut builder = VMContextBuilder::new();
//         builder
//             .current_account_id(accounts(0))
//             .signer_account_id(predecessor_account_id.clone())
//             .predecessor_account_id(predecessor_account_id)
//             .account_balance(INIT_ACCOUNT_BAL);
//         builder
//     }

//     // TODO: should panic type
//     #[test]
//     #[should_panic]
//     fn test_ft_not_enough_balance() {
//         let mut context = get_context(accounts(0));
//         testing_env!(context.build());

//         let mut contract = Contract::new();
//         let account_with_bal = accounts(1);
//         let token_account = accounts(0);

//         let mut bal: u128 = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 0);

//         contract.ft_on_transfer(
//             account_with_bal.to_string(),
//             "25".to_string(),
//             "".to_string(),
//         );

//         bal = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 25);

//         context = get_context(account_with_bal);
//         testing_env!(context.build());

//         contract.run_ephemeral(
//             SerializedSplitter {
//                 children: vec![SerializedNode::MallocCall {
//                     contract_id: "AA".to_string(),
//                     json_args: "{}".to_string(),
//                     gas: 128,
//                     attached_amount: 10.into(),
//                     next_splitters: vec![],
//                 }],
//                 splits: vec![100],
//                 ft_contract_id: token_account.to_string(),
//             },
//             U128::from(50),
//         );
//     }

//     #[test]
//     #[should_panic]
//     fn test_ft_not_enough_balance_never_registered() {
//         let mut context = get_context(accounts(0));
//         testing_env!(context.build());

//         let mut contract = Contract::new();
//         let account_with_bal = accounts(1);
//         let token_account = accounts(0);

//         let mut bal: u128 = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 0);

//         context = get_context(account_with_bal);
//         testing_env!(context.build());

//         contract.run_ephemeral(
//             SerializedSplitter {
//                 children: vec![SerializedNode::MallocCall {
//                     contract_id: "AA".to_string(),
//                     json_args: "{}".to_string(),
//                     gas: 128,
//                     attached_amount: 10.into(),
//                     next_splitters: vec![],
//                 }],
//                 splits: vec![100],
//                 ft_contract_id: (token_account.to_string()),
//             },
//             U128::from(50),
//         );
//     }

//     #[test]
//     fn test_ft_adding_balances_and_then_subtracting() {
//         let mut context = get_context(accounts(0));
//         testing_env!(context.build());

//         let mut contract = Contract::new();
//         let account_with_bal = accounts(1);
//         let token_account = accounts(0);

//         let mut bal: u128 = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 0);

//         contract.ft_on_transfer(
//             account_with_bal.to_string(),
//             "100".to_string(),
//             "".to_string(),
//         );

//         bal = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 100);

//         context = get_context(accounts(1));
//         testing_env!(context.build());
//         contract.run_ephemeral(
//             SerializedSplitter {
//                 children: vec![SerializedNode::MallocCall {
//                     contract_id: "AA".to_string(),
//                     json_args: "{}".to_string(),
//                     gas: 128,
//                     attached_amount: 10.into(),
//                     next_splitters: vec![],
//                 }],
//                 splits: vec![100],
//                 ft_contract_id: token_account.to_string(),
//             },
//             U128::from(50),
//         );
//         bal = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 50);

//         contract.run_ephemeral(
//             SerializedSplitter {
//                 children: vec![SerializedNode::MallocCall {
//                     contract_id: "AA".to_string(),
//                     json_args: "{}".to_string(),
//                     gas: 128,
//                     attached_amount: 10.into(),
//                     // next_splitters: vec![],
//                 }],
//                 splits: vec![100],
//                 ft_contract_id: token_account.to_string(),
//             },
//             U128::from(50),
//         );
//         bal = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 0);
//     }

//     #[test]
//     fn test_ft_adding_balances() {
//         let mut context = get_context(accounts(0));
//         testing_env!(context.build());

//         let mut contract = Contract::new();
//         let account_with_bal = accounts(1);
//         let token_account = accounts(0);
//         let token_account_2 = accounts(5);

//         let mut bal: u128 = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 0);

//         contract.ft_on_transfer(
//             account_with_bal.to_string(),
//             "100".to_string(),
//             "".to_string(),
//         );

//         bal = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 100);

//         contract.ft_on_transfer(
//             account_with_bal.to_string(),
//             "100".to_string(),
//             "".to_string(),
//         );
//         bal = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 200);

//         context = get_context(token_account_2.clone());
//         testing_env!(context.build());

//         bal = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account_2.to_string())
//             .into();
//         assert_eq!(bal, 0);
//         bal = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 200);

//         contract.ft_on_transfer(
//             account_with_bal.to_string(),
//             "100".to_string(),
//             "".to_string(),
//         );
//         bal = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account_2.to_string())
//             .into();
//         assert_eq!(bal, 100);
//         bal = contract
//             .get_ft_balance(account_with_bal.to_string(), token_account.to_string())
//             .into();
//         assert_eq!(bal, 200);
//     }
// }
