use malloc_call_core::ft::MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER_CALL;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::json;
use near_sdk::{env, log, AccountId, Gas};

use crate::errors::PanicError;
use crate::gas::CALLBACK_GAS;
use crate::node::NodeCall;

use super::NodeFunctions;

const HANDLE_GAS: Gas = 2_000_000_000_000;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct FtTransferCallToMallocCall {
    malloc_call_id: AccountId,
    token_id: AccountId,
}

impl NodeFunctions for FtTransferCallToMallocCall {
    fn handle(
        &self,
        contract: &mut crate::Contract,
        node_call: &NodeCall,
        construction_call_id: &crate::construction::ConstructionCallId,
        node_call_id: crate::node::NodeCallId,
        caller: &AccountId,
    ) -> Result<u64, crate::errors::PanicError> {
        let prom = contract.balances.internal_ft_transfer_call(
            &self.token_id,
            self.malloc_call_id.clone(),
            U128(node_call.amount),
            caller.clone(),
            None,
        );
        // TODO: you want a seperate callback here
        let callback = env::promise_batch_then(prom, env::current_account_id());
        // TODO: refactor this with the callback portion of MallocCall
        let callback_args = NodeCall::get_callback_args(
            construction_call_id,
            &node_call_id,
            caller,
            Some(&self.token_id),
        );
        env::promise_batch_action_function_call(
            callback,
            b"handle_node_callback",
            callback_args.as_bytes(),
            0,
            CALLBACK_GAS,
        );
        Ok(callback)
    }

    fn get_gas_requirement(&self, _node_call: &NodeCall) -> Result<Gas, PanicError> {
        Ok(MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER_CALL + HANDLE_GAS)
    }
}
