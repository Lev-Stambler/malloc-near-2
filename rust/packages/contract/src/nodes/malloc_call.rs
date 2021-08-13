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
pub struct MallocCall {
    check_callback: Option<bool>,
    skip_ft_transfer: Option<bool>,
    malloc_call_id: AccountId,
    token_id: AccountId,
    json_args: String,
    gas: Gas,
    attached_amount: near_sdk::json_types::U128,
}

impl NodeFunctions for MallocCall {
    fn handle(
        &self,
        contract: &mut crate::Contract,
        node_call: &NodeCall,
        construction_call_id: &crate::construction::ConstructionCallId,
        node_call_id: crate::node::NodeCallId,
        caller: &AccountId,
    ) -> Result<u64, crate::errors::PanicError> {
        let token_contract_id = self.token_id.clone();
        let call_data = format!(
            "{{\"args\": {}, \"amount\": \"{}\", \"token_id\": \"{}\", \"caller\": \"{}\"}}",
            self.json_args,
            node_call.amount.to_string(),
            token_contract_id.clone(),
            caller
        );

        log!("Node call amount: {}", node_call.amount);

        let call_prom = if node_call.amount > 0 && !self.skip_ft_transfer.unwrap_or(false) {
            // TODO: what if the ft_transfer prom fails???
            // See https://github.com/Lev-Stambler/malloc-near-2/issues/27
            let transfer_call_prom = contract.balances.internal_ft_transfer_call(
                &self.token_id,
                self.malloc_call_id.clone(),
                U128(node_call.amount),
                caller.clone(),
                None,
            );

            let call_prom = env::promise_then(
                transfer_call_prom,
                self.malloc_call_id.to_string(),
                &malloc_call_core::call_method_name(),
                call_data.as_bytes(),
                self.attached_amount.into(),
                self.gas,
            );
            call_prom
        } else {
            let call_prom = env::promise_batch_create(self.malloc_call_id.clone());
            env::promise_batch_action_function_call(
                call_prom,
                &malloc_call_core::call_method_name(),
                call_data.as_bytes(),
                self.attached_amount.into(),
                self.gas,
            );
            call_prom
        };

        // If check callback is false, finish the call and return
        if let Some(check_cb) = self.check_callback {
            if !check_cb {
                return Ok(call_prom);
            }
        }

        let callback = env::promise_batch_then(call_prom, env::current_account_id());
        let callback_args =
            NodeCall::get_callback_args(construction_call_id, &node_call_id, caller, None);
        env::promise_batch_action_function_call(
            callback,
            b"handle_node_callback",
            callback_args.as_bytes(),
            0,
            CALLBACK_GAS,
        );
        Ok(callback)
    }

    fn get_gas_requirement(&self, node_call: &NodeCall) -> Result<Gas, PanicError> {
        let callback_gas = if self.check_callback.unwrap_or(true) {
            CALLBACK_GAS
        } else {
            0
        };
        let ft_transfer_call_gas =
            if self.skip_ft_transfer.unwrap_or(false) || node_call.amount == 0 {
                0
            } else {
                malloc_call_core::ft::MALLOC_CALL_CORE_GAS_FOR_FT_TRANSFER_CALL
            };
        Ok(callback_gas + self.gas + ft_transfer_call_gas + HANDLE_GAS)
    }
}
