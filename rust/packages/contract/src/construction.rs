use crate::malloc_utils::GenericId;
use crate::action::{NextActionsIndicesForAction, NextActionsSplitsForAction, ActionCall, ActionId};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
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

use crate::errors::panic_errors;
use crate::{errors::PanicError, vector_wrapper::VectorWrapper, Contract, ActionCallId};

impl Construction {
    /// Convert a vector of splits and a given amount to a Vec of amount values.
    /// All of the amounts are rounded down, so the sum of the result may be slightly (at most the length of splits)
    /// Smaller than the input amount
    pub fn get_split_amounts(amount: u128, splits: VectorWrapper<u128>) -> Vec<u128> {
        let mut amounts = vec![];

        let mut split_sum = 0;
        for i in 0..splits.0.len() {
            split_sum += splits.0.get(i).unwrap();
        }

        for i in 0..splits.0.len() {
            let frac = (splits.0.get(i).unwrap() as f64) / (split_sum as f64);
            let transfer_amount_float = frac * amount as f64;
            let transfer_amount = transfer_amount_float.floor() as u128;
            amounts.push(transfer_amount);
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
        initial_splits: VectorWrapper<u128>,
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
