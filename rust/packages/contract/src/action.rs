use core::panic;
use std::convert::TryFrom;
use std::str::FromStr;

use malloc_call_core::ft::MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER_CALL;
use malloc_call_core::ReturnItem;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, log,
    serde_json::{self, json},
    AccountId, Promise,
};
use near_sdk::{utils, Gas};

use crate::actions::{self, ActionFunctions};
use crate::errors::PanicError;
use crate::malloc_utils::GenericId;
use crate::{
    errors::panic_errors, vector_wrapper::VectorWrapper, Construction, ConstructionCall,
    ConstructionCallId, ConstructionId, Contract,
};

pub type ActionId = GenericId;

pub type NextActionsIndicesForAction = VectorWrapper<VectorWrapper<u64>>;
pub type NextActionsSplitsForAction = VectorWrapper<VectorWrapper<U128>>;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub enum ActionCallStatus {
    /// The splitter call errored
    Error { message: String },
    /// The splitter call is waiting to be started
    WaitingCall,
    /// The splitter call is currently executing and waiting for a result
    Executing { block_index_start: u64 },
    /// The splitter call succeeded
    Success,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]

// TODO: expected_number_inputs if we make this a dag
// https://github.com/Lev-Stambler/malloc-near-2/issues/26
pub struct ActionCall {
    action_index_in_construction: u64,
    block_index: u64,
    pub amount: u128,
    /// The length of children_status should always equal the length of the splitter's children
    status: ActionCallStatus,
}

pub type ActionCallId = u64;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum Action {
    // TODO: add ft transfer see https://github.com/Lev-Stambler/malloc-near-2/issues/20
    // FtTransfer {
    //     receiver_id: AccountId,
    //     token_id: AccountId,
    // },
    FtTransferCallToMallocCall(actions::ft_calls::FtTransferCallToMallocCall),
    WithdrawFromMallocCall(actions::ft_calls::WithdrawFromMallocCall),
    MallocCall(actions::malloc_call::MallocCall),
}

impl Contract {
    /// Increments the next action call id and returns the current one
    fn incr_action_call_id(&mut self) -> ActionCallId {
        let curr = self.next_action_call_id;
        self.next_action_call_id = curr + 1;
        curr
    }
}

impl ActionCall {
    pub fn new_call_id(contract: &mut Contract) -> ActionCallId {
        contract.incr_action_call_id()
    }

    pub fn new(
        contract: &mut Contract,
        amount: u128,
        action_index_in_construction: u64,
    ) -> (ActionCall, ActionCallId) {
        (
            ActionCall {
                amount,
                status: ActionCallStatus::WaitingCall,
                block_index: env::block_index(),
                action_index_in_construction,
            },
            ActionCall::new_call_id(contract),
        )
    }

    pub fn action_calls_from_construction_indices(
        contract: &mut Contract,
        action_indices: Vec<u64>,
        amounts: Vec<u128>,
    ) -> Result<Vec<ActionCallId>, PanicError> {
        if action_indices.len() != amounts.len() {
            return Err(panic_errors::NUMB_NODES_DNE_NUMB_SPLITS.to_string());
        }

        let mut action_calls: Vec<ActionCallId> = Vec::with_capacity(action_indices.len());
        for i in 0..action_indices.len() {
            let (action_call, id) =
                ActionCall::new(contract, amounts[i], action_indices[i].to_owned());
            contract.action_calls.insert(&id, &action_call);

            action_calls.push(id);
        }

        Ok(action_calls)
    }
}

impl Contract {
    /// This call on _run assumes a well formed splitter
    /// Returns a refunded amount
    pub(crate) fn _run_step(&mut self, construction_call_id: ConstructionCallId) -> u64 {
        let mut construction_call = self.get_construction_call_unchecked(&construction_call_id);

        let action_call_index = construction_call
            .next_action_calls_stack
            .0
            .pop()
            .unwrap_or_else(|| panic!(panic_errors::CONSTRUCTION_CALL_SPLITTER_STACK_EMPTY));
        let action_call_id = construction_call
            .action_calls
            .0
            .get(action_call_index)
            .unwrap();
        let mut action_call = self
            .action_calls
            .get(&action_call_id)
            .unwrap_or_else(|| panic!(panic_errors::NODE_CALL_NOT_FOUND));

        let construction = self
            .get_construction(&construction_call.construction_id)
            .unwrap_or_else(|e| panic!("{}", e));

        let action_index = action_call.action_index_in_construction;
        let action_id = construction.actions.0.get(action_index).unwrap();

        let mut action = self.actions.get(&action_id).unwrap();

        self.construction_calls
            .insert(&construction_call_id, &&construction_call);

        let (prom, action_call) = action
            .handle_action(
                self,
                action_call,
                &construction_call_id,
                action_call_id,
                &env::predecessor_account_id(),
            )
            .unwrap_or_else(|e| panic!("{}", e));
        self.action_calls.insert(&action_call_id, &action_call);
        prom
    }
}

impl Action {
    // TODO: split up into helper functions
    // TODO: how to make sure all one input token type for a splitter?
    pub fn handle_action(
        &mut self,
        contract: &mut Contract,
        mut action_call: ActionCall,
        construction_call_id: &ConstructionCallId,
        action_call_id: ActionCallId,
        caller: &AccountId,
    ) -> Result<(u64, ActionCall), String> {
        // Set the child's status in the splitter call
        action_call.status = ActionCallStatus::Executing {
            block_index_start: env::block_index(),
        };
        let prom = match self {
            Action::FtTransferCallToMallocCall(ft_transfer_action) => ft_transfer_action.handle(
                contract,
                &action_call,
                construction_call_id,
                action_call_id,
                caller,
            ),
            Action::MallocCall(call) => call.handle(
                contract,
                &action_call,
                construction_call_id,
                action_call_id,
                caller,
            ),
            Action::WithdrawFromMallocCall(ft_withdraw_action) => ft_withdraw_action.handle(
                contract,
                &action_call,
                construction_call_id,
                action_call_id,
                caller,
            ),
        };
        let prom_ret = prom?;
        Ok((prom_ret, action_call))
    }
}

impl ActionCall {
    pub(crate) fn get_callback_args(
        construction_call_id: &ConstructionCallId,
        action_call_id: &ActionCallId,
        caller: &AccountId,
        token_return_id: Option<&AccountId>,
    ) -> String {
        let callback_args = match token_return_id {
            None => json!({
                    "construction_call_id": construction_call_id,
                "action_call_id": action_call_id,
                "caller": caller }),
            Some(token_id) => json!({
                    "construction_call_id": construction_call_id,
                "action_call_id": action_call_id,
                "token_return_id": token_id,
                "caller": caller }),
        };
        callback_args.to_string()
    }

    // TODO: error handling
    pub(crate) fn get_results_from_returned_bytes(
        ret_bytes: Vec<u8>,
        token_id: Option<ValidAccountId>,
    ) -> Result<Vec<ReturnItem>, String> {
        let as_u128: Result<String, _> = serde_json::from_slice(&ret_bytes);
        if let Ok(amount_ret) = as_u128 {
            let token_id = token_id.unwrap();
            return Ok(vec![ReturnItem {
                token_id: token_id,
                amount: amount_ret,
            }]);
        };

        let as_return_vec: Result<Vec<ReturnItem>, _> = serde_json::from_slice(&ret_bytes);
        if let Ok(return_vec) = as_return_vec {
            return Ok(return_vec);
        }
        panic!("EXPECTED ONE OF THESE TO WORK")
    }

    pub(crate) fn handle_action_callback_internal(
        &mut self,
        contract: &mut Contract,
        construction_call_id: ConstructionCallId,
        caller: AccountId,
        results: Vec<ReturnItem>,
    ) -> Option<u64> {
        let mut construction_call = contract.get_construction_call_unchecked(&construction_call_id);
        let construction_res = contract.get_construction(&construction_call.construction_id);
        // TODO: error handling with the malloc call cores
        let construction = construction_res.unwrap();

        // // TODO: error handling with the malloc call cores
        // let action_call_res = self.action_calls.get(&action_call_id);
        // let action_call = action_call_res.unwrap();

        // TODO: error handle with malloc call core
        let next_actions_indices = construction_call
            .next_actions_indices_in_construction
            .0
            .get(self.action_index_in_construction)
            .unwrap();

        // TODO: error handle with malloc call core
        let next_actions_splits = construction_call
            .next_actions_splits
            .0
            .get(self.action_index_in_construction)
            .unwrap();
        if next_actions_indices.0.len() != next_actions_splits.0.len() {
            // TODO: error handling with the malloc call cores
            panic!("");
        }

        // TODO: error handle here
        let amounts: Vec<u128> = results
            .iter()
            .map(|r| r.amount.parse::<u128>().unwrap())
            .collect();

        if amounts.len() != next_actions_indices.0.len() as usize {
            // TODO: error handling
            panic!("Expected the returned number of tokens to be the same length as next actions")
        }

        for i in 0..next_actions_indices.0.len() {
            construction_call = self.handle_next_split_set(
                contract,
                construction_call,
                next_actions_indices.0.get(i).unwrap(),
                next_actions_splits.0.get(i).unwrap(),
                amounts[i as usize],
            );
        }
        contract
            .construction_calls
            .insert(&construction_call_id, &construction_call);
        None
    }

    fn handle_next_split_set(
        &mut self,
        contract: &mut Contract,
        mut construction_call: ConstructionCall,
        next_action_indxs: VectorWrapper<u64>,
        next_splits: VectorWrapper<U128>,
        amount: u128,
    ) -> ConstructionCall {
        let next_amounts = Construction::get_split_amounts(amount, next_splits);
        for i in 0..next_amounts.len() {
            let (action_call, action_call_id) = ActionCall::new(
                contract,
                next_amounts[i],
                next_action_indxs.0.get(i as u64).unwrap(),
            );
            contract.action_calls.insert(&action_call_id, &action_call);
            log!(
                "Pushing a action_call with index into construction action calls of {}",
                action_call.action_index_in_construction
            );
            construction_call
                .next_action_calls_stack
                .0
                .push(&construction_call.action_calls.0.len());
            construction_call.action_calls.0.push(&action_call_id);
        }
        construction_call
    }
}

#[cfg(test)]
mod tests {
    use crate::test_utils::tests::return_item_eq;

    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;

    #[test]
    fn test_getting_result_from_bytes_error() {}

    #[test]
    fn test_getting_result_from_bytes() {
        let amount = "10".to_string();
        let token_id = ValidAccountId::try_from("wrap.testnet").unwrap();
        let amount_json = json!(amount.clone());
        let ret_items_json = json!(vec![ReturnItem {
            token_id: token_id.clone(),
            amount: amount.clone()
        },]);
        let from_amount = ActionCall::get_results_from_returned_bytes(
            amount_json.to_string().into_bytes(),
            Some(token_id.clone()),
        )
        .unwrap();

        let from_ret_items = ActionCall::get_results_from_returned_bytes(
            ret_items_json.to_string().into_bytes(),
            None,
        )
        .unwrap();

        assert_eq!(from_ret_items.len(), 1);
        assert_eq!(from_amount.len(), 1);

        assert!(return_item_eq(
            &from_amount[0],
            &ReturnItem { amount, token_id }
        ));
        assert!(return_item_eq(&from_amount[0], &from_ret_items[0]));
    }
}
