/*
 * This is an example of a Rust smart contract with two simple, symmetric functions:
 *
 * 1. set_greeting: accepts a greeting, such as "howdy", and records it for the user (account_id)
 *    who sent the request
 * 2. get_greeting: accepts an account_id and returns the greeting saved for it, defaulting to
 *    "Hello"
 *
 * Learn more about writing NEAR smart contracts with Rust:
 * https://github.com/near/near-sdk-rs
 *
 */

use construction::{
    Construction, ConstructionCall, ConstructionCallId, ConstructionId,
    NextActionsIndicesForConstruction, NextActionsSplitsForConstruction,
};
use malloc_call_core::ft::{FungibleTokenBalances, FungibleTokenHandlers};
use malloc_call_core::{MallocCallFT, ReturnItem};
// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use action::{Action, ActionCall, ActionCallId, ActionId};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::{ValidAccountId, U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, log, near_bindgen, serde, serde_json, setup_alloc, utils, AccountId, Gas, PanicOnDefault,
};
use vector_wrapper::VectorWrapper;

use crate::errors::panic_errors;

mod action;
mod actions;
mod construction;
pub mod errors;
mod gas;
mod malloc_utils;
mod test_utils;
mod vector_wrapper;

setup_alloc!();
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault, MallocCallFT)]
/// The Contract's state
pub struct Contract {
    /// A store for all the constructions. Constructions are meant to be immutable objects
    // TODO: enforce immutability: https://github.com/Lev-Stambler/malloc-near-2/issues/18
    constructions: UnorderedMap<ConstructionId, Construction>,
    /// A store of all the construction calls. Construction calls are mutable and ephemeral objects
    /// They should only live as long as a single call to a construction
    construction_calls: UnorderedMap<ConstructionCallId, ConstructionCall>,
    /// A store of all the action calls. Action calls are mutable and ephemeral objects
    /// They should only live as long as a single call to a construction. They get deleted
    /// When a construction call gets deleted
    action_calls: UnorderedMap<ActionCallId, ActionCall>,
    /// A store for all the actions. Actions are meant to be immutable objects
    // TODO: enforce immutability: https://github.com/Lev-Stambler/malloc-near-2/issues/18
    actions: UnorderedMap<ActionId, Action>,
    /// Balances keeps track of all the users' balances. See malloc-call-core's documentation for more information
    balances: FungibleTokenBalances,
    /// Keeps track of the next action call id so that action call id's can all be unique and need not be supplied by the caller
    next_action_call_id: ActionCallId,
    /// The current contract's ID. This field is needed for MallocCallFT
    malloc_contract_id: AccountId,
}

pub trait CoreFunctionality {
    fn register_actions(&mut self, action_names: Vec<String>, actions: Vec<Action>);
    fn register_construction(&mut self, construction_name: String, construction: Construction);
    fn init_construction(
        &mut self,
        construction_call_id: ConstructionCallId,
        construction_id: ConstructionId,
        amount: U128,
        initial_action_indices: Vec<u64>,
        initial_splits: VectorWrapper<U128>,
        next_actions_indices: NextActionsIndicesForConstruction,
        next_actions_splits: NextActionsSplitsForConstruction,
    );
    fn delete_construction(&mut self, construction_id: ConstructionId);
    fn process_next_action_call(&mut self, construction_call_id: ConstructionCallId);
}

#[near_bindgen]
impl CoreFunctionality for Contract {
    fn delete_construction(&mut self, construction_id: ConstructionId) {
        todo!();
        // self.delete_construction_internal(construction_id, env::predecessor_account_id())
        //     .unwrap_or_else(|e| panic!(e))
    }

    fn register_actions(&mut self, action_names: Vec<String>, actions: Vec<Action>) {
        assert_eq!(
            action_names.len(),
            actions.len(),
            "{}",
            panic_errors::NUMB_OF_NODES_NOT_EQUAL_TO_NUMB_NAMES
        );

        let owner = Some(env::predecessor_account_id());
        for i in 0..action_names.len() {
            self.actions.insert(
                &ActionId::new(action_names[i].clone(), owner.clone()),
                &actions[i],
            );
        }
    }

    fn register_construction(&mut self, construction_name: String, construction: Construction) {
        self.constructions
            .insert(&ConstructionId::new(construction_name, None), &construction);
    }

    fn init_construction(
        &mut self,
        construction_call_id: ConstructionCallId,
        construction_id: ConstructionId,
        amount: U128,
        initial_action_indices: Vec<u64>,
        initial_splits: VectorWrapper<U128>,
        next_actions_indices: NextActionsIndicesForConstruction,
        next_actions_splits: NextActionsSplitsForConstruction,
    ) {
        let caller = env::predecessor_account_id();

        let construction = self
            .get_construction(&construction_id)
            .unwrap_or_else(|e| panic!(e));

        let construction_call = ConstructionCall::new(
            self,
            caller,
            construction_id,
            &construction_call_id,
            amount.into(),
            initial_action_indices,
            initial_splits,
            next_actions_indices,
            next_actions_splits,
        )
        .unwrap_or_else(|e| panic!(e));

        self.construction_calls
            .insert(&construction_call_id, &construction_call);
    }

    fn process_next_action_call(&mut self, construction_call_id: ConstructionCallId) {
        self._run_step(construction_call_id);
        log!("Gas used: {}", env::used_gas());
    }
}

#[near_bindgen]
impl Contract {
    pub fn get_action_call_unchecked(&self, id: U64) -> ActionCall {
        self.action_calls.get(&id.into()).unwrap()
    }

    pub fn get_construction_call_unchecked(&self, id: &ConstructionCallId) -> ConstructionCall {
        self.construction_calls
            .get(&id)
            .unwrap_or_else(|| panic!(panic_errors::CONSTRUCTION_NOT_FOUND))
    }
}

#[near_bindgen]
impl Contract {
    fn get_gas_usage(&self) -> Gas {
        75_000_000_000_000
    }
}

#[near_bindgen]
impl Contract {
    #[private]
    pub fn handle_action_callback(
        &mut self,
        construction_call_id: ConstructionCallId,
        action_call_id: u64,
        caller: AccountId,
        token_return_id: Option<ValidAccountId>,
    ) -> Option<u64> {
        // TODO: err handle!!
        let mut action_call = self.action_calls.get(&action_call_id).unwrap();
        let ret_bytes = match utils::promise_result_as_success() {
            None => panic!("TODO:"),
            Some(bytes) => bytes,
        };
        let results: Vec<ReturnItem> =
            ActionCall::get_results_from_returned_bytes(ret_bytes, token_return_id).unwrap();
        action_call.handle_action_callback_internal(self, construction_call_id, caller, results)
    }
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Contract {
            balances: FungibleTokenBalances::new("malloc-ft".as_bytes()),
            action_calls: UnorderedMap::<ActionCallId, ActionCall>::new("actioncalls".as_bytes()),
            actions: UnorderedMap::new("actions".as_bytes()),
            next_action_call_id: 0,
            constructions: UnorderedMap::new("constructions".as_bytes()),
            construction_calls: UnorderedMap::new("construction-call-stack".as_bytes()),
            malloc_contract_id: env::current_account_id(),
        }
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
    fn test_register_construction() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let mut contract = Contract::new();
        let token_id1 = ValidAccountId::try_from("wrapp.localnet".to_string()).unwrap();
        let token_id2 = ValidAccountId::try_from("wrappppp.localnet".to_string()).unwrap();

        let action2 = Action::FtTransferCallToMallocCall(FtTransferCallToMallocCall {
            malloc_call_id: accounts(2),
            token_id: token_id1,
        });
        let action1 = Action::FtTransferCallToMallocCall(FtTransferCallToMallocCall {
            malloc_call_id: accounts(2),
            token_id: token_id2,
        });
        contract.register_actions(
            vec!["action1".to_string(), "action2".to_string()],
            vec![action1.clone(), action2.clone()],
        );
        let construction_name = "Jimbe First Son of the Sea".to_string();
        let construction = Construction {
            actions: VectorWrapper::from_vec(
                vec![
                    GenericId {
                        name: "action1".to_string(),
                        owner: accounts(0).to_string(),
                    },
                    GenericId {
                        name: "action2".to_string(),
                        owner: accounts(0).to_string(),
                    },
                ],
                "my prefix".as_bytes(),
            ),
        };
        contract.register_construction(construction_name.clone(), construction.clone());
        let construction_got = contract.get_construction(&GenericId {
            name: construction_name,
            owner: accounts(0).to_string(),
        });
        assert_eq!(construction_got.unwrap(), construction);
    }

    #[test]
    fn test_init_construction() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let mut contract = Contract::new();
        let token_id1 = ValidAccountId::try_from("wrapp.localnet".to_string()).unwrap();
        let token_id2 = ValidAccountId::try_from("wrappppp.localnet".to_string()).unwrap();

        let action2 = Action::FtTransferCallToMallocCall(FtTransferCallToMallocCall {
            malloc_call_id: accounts(2),
            token_id: token_id1,
        });
        let action1 = Action::FtTransferCallToMallocCall(FtTransferCallToMallocCall {
            malloc_call_id: accounts(2),
            token_id: token_id2,
        });
        contract.register_actions(
            vec!["action1".to_string(), "action2".to_string()],
            vec![action1.clone(), action2.clone()],
        );
        let construction_name = "Jimbe First Son of the Sea".to_string();
        let construction = Construction {
            actions: VectorWrapper::from_vec(
                vec![
                    GenericId {
                        name: "action1".to_string(),
                        owner: accounts(0).to_string(),
                    },
                    GenericId {
                        name: "action2".to_string(),
                        owner: accounts(0).to_string(),
                    },
                ],
                "my prefix".as_bytes(),
            ),
        };
        contract.register_construction(construction_name.clone(), construction.clone());

        let construction_call_id = "mycall".to_string();
        let construction_id = GenericId {
            name: construction_name.clone(),
            owner: accounts(0).into(),
        };
        let amount = U128(100);
        let initial_action_indices = vec![0, 1];
        let initial_splits: VectorWrapper<U128> = serde_json::from_str("[\"1\", \"2\"]").unwrap();
        let next_actions_indices: NextActionsIndicesForConstruction =
            serde_json::from_str("[[[]], [[]]]").unwrap();
        let next_actions_splits: NextActionsSplitsForConstruction =
            serde_json::from_str("[[[]], [[]]]").unwrap();

        contract.init_construction(
            construction_call_id.clone(),
            construction_id.clone(),
            amount.clone(),
            initial_action_indices.clone(),
            initial_splits.clone(),
            next_actions_indices.clone(),
            next_actions_splits.clone(),
        );

        let construction_call = ConstructionCall::new(
            &mut &mut contract,
            accounts(0).to_string(),
            construction_id,
            &"aaaaaaa".to_string(), // Have a new construction call id to avoid re-registering
            amount.0,
            initial_action_indices,
            initial_splits,
            next_actions_indices,
            next_actions_splits,
        )
        .unwrap();
        let registered = contract.get_construction_call_unchecked(&construction_call_id);
        assert_ne!(&registered.action_calls, &construction_call.action_calls);

        assert_eq!(&registered.caller, &construction_call.caller);
        assert_eq!(
            &registered.construction_id,
            &construction_call.construction_id
        );
        assert_eq!(
            &registered.next_action_calls_stack,
            &construction_call.next_action_calls_stack
        );
        assert_eq!(
            &registered.next_actions_indices_in_construction,
            &construction_call.next_actions_indices_in_construction
        );
        assert_eq!(
            &registered.next_actions_splits,
            &construction_call.next_actions_splits
        );
    }

    #[test]
    fn test_register_actions() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let mut contract = Contract::new();

        let token_id1 = ValidAccountId::try_from("wrapp.localnet".to_string()).unwrap();
        let token_id2 = ValidAccountId::try_from("wrappppp.localnet".to_string()).unwrap();

        let action2_prereigster = Action::FtTransferCallToMallocCall(FtTransferCallToMallocCall {
            malloc_call_id: accounts(2),
            token_id: token_id1,
        });
        let action1_prereigster = Action::FtTransferCallToMallocCall(FtTransferCallToMallocCall {
            malloc_call_id: accounts(2),
            token_id: token_id2,
        });
        contract.register_actions(
            vec!["action1".to_string(), "action2".to_string()],
            vec![action1_prereigster.clone(), action2_prereigster.clone()],
        );
        let action1 = contract.actions.get(&GenericId {
            owner: accounts(0).to_string(),
            name: "action1".to_string(),
        });
        let action2 = contract.actions.get(&GenericId {
            owner: accounts(0).to_string(),
            name: "action2".to_string(),
        });
        assert!(action1.is_some());
        assert!(action2.is_some());

        assert_eq!(action1.unwrap(), action1_prereigster);
        assert_eq!(action2.unwrap(), action2_prereigster);
    }
}
