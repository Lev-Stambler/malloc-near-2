use near_sdk::{AccountId, Gas};

use crate::{Contract, construction::ConstructionCallId, errors::PanicError, action::{ActionCall, ActionCallId}};

pub mod ft_calls;
pub mod malloc_call;

pub trait ActionFunctions {
		/// Handle a action
		/// @returns a result of a promise index
    fn handle(
        &self,
        contract: &mut Contract,
        action_call: &ActionCall,
        construction_call_id: &ConstructionCallId,
        action_call_id: ActionCallId,
        caller: &AccountId,
    ) -> Result<u64, PanicError>;

		fn get_gas_requirement(&self, action_call: &ActionCall) -> Result<Gas, PanicError>;
}
