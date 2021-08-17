use malloc_call_core::ft::MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER_CALL;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::json;
use near_sdk::{env, log, AccountId, Gas};

use crate::errors::PanicError;
use crate::gas::CALLBACK_GAS;
use crate::action::ActionCall;

use super::ActionFunctions;

const HANDLE_GAS: Gas = 2_000_000_000_000;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct FtTransferCallToMallocCall {
    pub malloc_call_id: AccountId,
    pub token_id: AccountId,
}

impl ActionFunctions for FtTransferCallToMallocCall {
    fn handle(
        &self,
        contract: &mut crate::Contract,
        action_call: &ActionCall,
        construction_call_id: &crate::construction::ConstructionCallId,
        action_call_id: crate::action::ActionCallId,
        caller: &AccountId,
    ) -> Result<u64, crate::errors::PanicError> {
        let prom = contract.balances.internal_ft_transfer_call(
            &self.token_id,
            self.malloc_call_id.clone(),
            U128(action_call.amount),
            caller.clone(),
            None,
        );
        // TODO: you want a seperate callback here
        let callback = env::promise_batch_then(prom, env::current_account_id());
        // TODO: refactor this with the callback portion of MallocCall
        let callback_args = ActionCall::get_callback_args(
            construction_call_id,
            &action_call_id,
            caller,
            Some(&self.token_id),
        );
        env::promise_batch_action_function_call(
            callback,
            b"handle_action_callback",
            callback_args.as_bytes(),
            0,
            CALLBACK_GAS,
        );
        Ok(callback)
    }

    fn get_gas_requirement(&self, _action_call: &ActionCall) -> Result<Gas, PanicError> {
        Ok(MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER_CALL + HANDLE_GAS)
    }
}
