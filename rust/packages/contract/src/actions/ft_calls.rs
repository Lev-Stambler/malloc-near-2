use malloc_call_core::ft::{
    FungibleTokenBalances, TransferType, MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER_CALL,
    MALLOC_CALL_CORE_GAS_FOR_WITHDRAW_WITH_FT_TRANSFER_CALL,
    MALLOC_CALL_CORE_GAS_FOR_WITHDRAW_TO
};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::{ValidAccountId, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::json;
use near_sdk::{env, log, AccountId, Gas};

use crate::action::ActionCall;
use crate::errors::PanicError;
use crate::gas::{CALLBACK_GAS, CROSS_CONTRACT_BASE_GAS};

use super::ActionFunctions;

const HANDLE_GAS: Gas = 2_000_000_000_000;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct FtTransferCallToMallocCall {
    pub malloc_call_id: ValidAccountId,
    pub token_id: ValidAccountId,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, PartialEq, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct WithdrawFromMallocCall {
    pub malloc_call_id: ValidAccountId,
    pub token_id: ValidAccountId,
    pub recipient: Option<ValidAccountId>,
}

impl ActionFunctions for WithdrawFromMallocCall {
    fn handle(
        &self,
        contract: &mut crate::Contract,
        action_call: &ActionCall,
        construction_call_id: &crate::construction::ConstructionCallId,
        action_call_id: crate::action::ActionCallId,
        caller: &AccountId,
    ) -> Result<u64, PanicError> {
        let token_id: AccountId = self.token_id.to_string();
        let malloc_call_id: AccountId = self.malloc_call_id.to_string();

        // Use a transfer call malloc if the call is calling itself
        // Use a transfer if it is transferring to an account
        let transfer_type = if self.recipient == None {
            TransferType::TransferCallMalloc()
        } else {
            TransferType::Transfer()
        };

        let recipient = self
            .recipient
            .as_ref()
            .map(|v| v.to_string())
            .unwrap_or(env::current_account_id());

        let args = FungibleTokenBalances::get_withdraw_to_args(
            caller,
            U128(action_call.amount),
            &token_id,
            &recipient,
            None,
            transfer_type,
        )
        .map_err(|e| e.to_string())?;

        let prom = env::promise_batch_create(malloc_call_id);
        env::promise_batch_action_function_call(
            prom,
            "withdraw_to".as_bytes(),
            args.as_bytes(),
            1,
            MALLOC_CALL_CORE_GAS_FOR_WITHDRAW_TO + CROSS_CONTRACT_BASE_GAS,
        );

        let callback = env::promise_batch_then(prom, env::current_account_id());
        let callback_args = ActionCall::get_callback_args(
            construction_call_id,
            &action_call_id,
            caller,
            Some(&token_id),
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

    fn get_gas_requirement(&self, action_call: &ActionCall) -> Result<Gas, PanicError> {
        Ok(MALLOC_CALL_CORE_GAS_FOR_WITHDRAW_TO + HANDLE_GAS + CALLBACK_GAS + CROSS_CONTRACT_BASE_GAS)
    }
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
        let token_id: AccountId = self.token_id.to_string();
        let malloc_call_id: AccountId = self.malloc_call_id.to_string();
        let prom = contract.balances.internal_ft_transfer_call(
            &token_id,
            malloc_call_id,
            U128(action_call.amount),
            caller.clone(),
            None,
        );
        let callback = env::promise_batch_then(prom, env::current_account_id());
        let callback_args = ActionCall::get_callback_args(
            construction_call_id,
            &action_call_id,
            caller,
            Some(&token_id),
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
        Ok(MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER_CALL + CALLBACK_GAS + HANDLE_GAS)
    }
}
