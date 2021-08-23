use crate::action::{
    ActionCall, ActionId, NextActionsIndicesForAction, NextActionsSplitsForAction,
};
use crate::malloc_utils::GenericId;
use crate::malloc_utils::U256;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{collections::Vector, env, AccountId};

pub type ConstructionCallId = String;

/// A Construction is the collection of actions. It can be used to form the call DAG
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Construction {
    pub actions: VectorWrapper<ActionId>,
}

pub type ConstructionId = GenericId;

pub type NextActionsIndicesForConstruction = VectorWrapper<NextActionsIndicesForAction>;
pub type NextActionsSplitsForConstruction = VectorWrapper<NextActionsSplitsForAction>;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
/// ConstructionCalls contain all the dynamic data when calling a construction
/// They are unique per construction call, so once a user is done calling a construction,
/// They should delete the construction call
pub struct ConstructionCall {
    pub caller: AccountId,
    pub construction_id: ConstructionId,
    // TODO: ideally we want to have a queue not a stack (so we have BFS not DFS). But, Vector only supports O(1) stack ops.
    // See https://github.com/Lev-Stambler/malloc-near-2/issues/16
    /// A vector which indexes into the action call vector
    /// Indicates which action_calls should be called next
    pub next_action_calls_stack: VectorWrapper<u64>,
    /// A vector which contains the action call id's for all the actions which the
    /// construction call already interacted with (either pushing it onto the stack, executing it, or handling a action's return
    pub action_calls: VectorWrapper<ActionCallId>,

    // TODO: move into separate lookup table with id ref: See https://github.com/Lev-Stambler/malloc-near-2/issues/17
    pub next_actions_indices_in_construction: NextActionsIndicesForConstruction,
    pub next_actions_splits: NextActionsSplitsForConstruction,
}

use crate::errors::panic_errors::{self, NUMB_OF_SPLITS_DOES_NOT_EQUAL_NUMB_AMOUNTS};
use crate::{errors::PanicError, vector_wrapper::VectorWrapper, ActionCallId, Contract};

impl Construction {
    /// Convert a vector of splits and a given amount to a Vec of amount values.
    /// All of the amounts are rounded down except the last one. So, if there is any remainder, it will be summed to the last output
    /// Smaller than the input amount
    pub fn get_split_amounts(amount: u128, splits: VectorWrapper<U128>) -> Vec<u128> {
        let mut amounts = vec![];

        // TODO: to u256
        let mut split_sum: U256 = U256::from(0);
        for i in 0..splits.0.len() {
            split_sum += U256::from(splits.0.get(i).unwrap().0);
        }

        for i in 0..splits.0.len() {
            let transfer_amount_u256: U256 =
                U256::from(splits.0.get(i).unwrap().0) * U256::from(amount) / split_sum;
            let transfer_amount = transfer_amount_u256.as_u128();
            // let frac = (splits.0.get(i).unwrap() as f64) / (split_sum as f64);
            // let transfer_amount_float = frac * amount as f64;
            // let transfer_amount = transfer_amount_float.floor() as u128;
            amounts.push(transfer_amount);
        }
        let unused: u128 = amount - amounts.iter().sum::<u128>();
        assert_eq!(
            amounts.len() as u64,
            splits.0.len(),
            "{}",
            NUMB_OF_SPLITS_DOES_NOT_EQUAL_NUMB_AMOUNTS.to_owned()
        );
        if amounts.len() > 1 {
            amounts[splits.0.len() as usize - 1] += unused;
        }
        amounts
    }
}

impl ConstructionCall {
    /// Creates a new construction call and also places all elements from action_call_ids into the new stack
    pub fn new(
        contract: &mut Contract,
        caller: AccountId,
        construction_id: ConstructionId,
        construction_call_id: &ConstructionCallId,
        amount: u128,
        initial_action_indices: Vec<u64>,
        initial_splits: VectorWrapper<U128>,
        next_actions_indices: NextActionsIndicesForConstruction,
        next_actions_splits: NextActionsSplitsForConstruction,
    ) -> Result<ConstructionCall, PanicError> {
        // Ensure the construction call id is not already registered
        assert!(
            contract
                .construction_calls
                .get(&construction_call_id)
                .is_none(),
            "{}",
            panic_errors::CONSTRUCTION_CALL_ID_ALREADY_USED
        );

        // Ensure the construction actually exists
        let _construction = contract.get_construction(&construction_id)?;

        // Create the vectors necessary for the construction call
        let vect_prefix_str_action_stack = format!("constcall-stack-{}", construction_call_id);
        let vect_prefix_action_call_stack = vect_prefix_str_action_stack.as_bytes();

        let initial_amounts = Construction::get_split_amounts(amount, initial_splits);
        let init_action_calls = ActionCall::action_calls_from_construction_indices(
            contract,
            initial_action_indices,
            initial_amounts,
        )
        .unwrap_or_else(|e| panic!("{}", e));

        let action_call_ids_prefix = format!("{}-actions", construction_call_id);
        let action_call_ids =
            VectorWrapper::from_vec(init_action_calls, action_call_ids_prefix.as_bytes());

        // Create the call stack and push the initial calls onto it
        let mut action_call_stack = VectorWrapper(Vector::new(vect_prefix_action_call_stack));
        for i in 0..action_call_ids.0.len() {
            action_call_stack.0.push(&i);
        }

        Ok(ConstructionCall {
            caller,
            construction_id,
            action_calls: action_call_ids,
            next_action_calls_stack: action_call_stack,
            next_actions_indices_in_construction: next_actions_indices,
            next_actions_splits,
        })
    }
}

impl Contract {
    pub fn get_construction(&self, id: &ConstructionId) -> Result<Construction, PanicError> {
        self.constructions
            .get(&id)
            .ok_or(panic_errors::CONSTRUCTION_NOT_FOUND.to_string())
    }
}
#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    const INIT_ACCOUNT_BAL: u128 = 10_000;

    use std::convert::TryFrom;

    use crate::actions::ft_calls::FtTransferCallToMallocCall;
    use crate::malloc_utils::GenericId;

    use super::*;
    use near_sdk::json_types::ValidAccountId;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;
    use near_sdk::MockedBlockchain;

    // mock the context for testing, notice "signer_account_id" that was accessed above from env::
    fn get_context(predecessor_account_id: ValidAccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id)
            .account_balance(INIT_ACCOUNT_BAL);
        builder
    }

    #[test]
    fn test_get_split_amount_with_leftover() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());

        let ret = Construction::get_split_amounts(
            100,
            VectorWrapper::from_vec(vec![U128(10), U128(10), U128(10)], "1".as_bytes()),
        );
        assert_eq!(ret, vec![33, 33, 34]);
    }

    #[test]
    fn test_get_split_amount_even_numbers() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());

        let ret = Construction::get_split_amounts(
            1_000_000,
            VectorWrapper::from_vec(vec![U128(10), U128(40), U128(50)], "1".as_bytes()),
        );
        assert_eq!(ret, vec![100_000, 400_000, 500_000]);
    }
}
