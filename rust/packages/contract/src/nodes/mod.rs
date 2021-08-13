use near_sdk::{AccountId, Gas};

use crate::{Contract, construction::ConstructionCallId, errors::PanicError, node::{NodeCall, NodeCallId}};

pub mod ft_calls;
pub mod malloc_call;

pub trait NodeFunctions {
		/// Handle a node
		/// @returns a result of a promise index
    fn handle(
        &self,
        contract: &mut Contract,
        node_call: &NodeCall,
        construction_call_id: &ConstructionCallId,
        node_call_id: NodeCallId,
        caller: &AccountId,
    ) -> Result<u64, PanicError>;

		fn get_gas_requirement(&self, node_call: &NodeCall) -> Result<Gas, PanicError>;
}
