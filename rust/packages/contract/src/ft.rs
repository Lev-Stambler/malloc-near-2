use near_sdk::{json_types::U128, AccountId};

use crate::{
    errors::{throw_err, Errors},
    AccountBalance, Contract,
};

pub trait FungibleTokenHandlers {
    fn ft_on_transfer(&mut self, sender_id: String, amount: String, msg: String) -> String;
    fn get_ft_balance(&self, account_id: AccountId, contract_id: AccountId) -> U128;
}

impl Contract {
    pub(crate) fn balance_pos(balances: &[AccountBalance], contract_id: &str) -> Option<usize> {
        balances.iter().position(|r| r.contract_id == contract_id)
    }

    pub(crate) fn subtract_contract_bal_from_user(
        &mut self,
        account_id: &AccountId,
        contract_id: AccountId,
        amount: u128,
    ) {
        if amount == 0 {
            return;
        }

        let mut balances = self
            .account_id_to_ft_balances
            .get(&account_id)
            .unwrap_or_else(|| panic!(Errors::CalleeDidNotDepositSufficientFunds)); // TODO change to throw err

        let bal_pos = Self::balance_pos(&balances, &contract_id)
            .unwrap_or_else(|| panic!(Errors::CalleeDidNotDepositSufficientFunds));
        if balances[bal_pos].balance < amount {
            throw_err(Errors::CalleeDidNotDepositSufficientFunds);
        }
        balances[bal_pos].balance -= amount;
        self.account_id_to_ft_balances
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
