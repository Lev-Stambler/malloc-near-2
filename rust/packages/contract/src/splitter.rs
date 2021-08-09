use core::panic;
use std::string;

use near_sdk::{AccountId, Promise, bs58::alphabet::Error, env, log, serde_json::{self, json}};

use crate::{BASIC_GAS, CALLBACK_GAS, Construction, ConstructionCallData, ConstructionCallDataId, ConstructionId, ConstructionNextSplitters, Contract, Node, NodeCallStatus, Splitter, SplitterCall, SplitterCallId, SplitterId, errors::{Errors}, handle_not_found, serde_ext::VectorWrapper, splitter};

impl Contract {
    /// This call on _run assumes a well formed splitter
    /// Returns a refunded amount
    pub(crate) fn _run_step(
        &mut self,
        construction_call_id: ConstructionCallDataId,
    ) -> u64 {
        let mut construction_call = self.get_construction_call_unchecked(&construction_call_id);

        let splitter_call_id = construction_call.next_splitter_call_stack.0.pop().unwrap_or_else(|| panic!(Errors::CONSTRUCTION_CALL_SPLITTER_STACK_EMPTY));
        let mut splitter_call = construction_call.splitter_calls.0.get(splitter_call_id).unwrap_or_else(|| panic!(Errors::CONSTRUCTION_CALL_SPLITTER_CALL_NOT_FOUND));

        // You can panic here as it is expected that _run_step is not called on a callback
        // TODO: how can this be enforced?
        let construction = self.get_construction(&construction_call.construction_id).unwrap_or_else(|e| panic!(&e));

        let splitter_id = construction.splitters.0.get(splitter_call.splitter_index).unwrap_or_else(|| panic!(&Errors::SPLITTER_NOT_FOUND_IN_CONSTRUCTION.to_string()));

        let splitter = self.get_splitter(&splitter_id).unwrap_or_else(|e| panic!(&e));

         let (split_call_prom, updated_splitter_call) = self.handle_splits(
            &splitter,
            splitter_call.amount,
            &construction_call_id,
            splitter_call_id,
            splitter_call.splitter_index,
            splitter_call,
            &env::predecessor_account_id(),
        ).unwrap_or_else(|e| panic!(&e));

       construction_call.splitter_calls.0.replace(splitter_call_id, &updated_splitter_call);

        // Update the construction call to include the new stack and status
        self.construction_calls
            .insert(&construction_call_id, &construction_call);

        log!("Gas used for this run step: {}", env::used_gas());

       let ret_prom = env::promise_batch_then(split_call_prom, env::current_account_id());
        ret_prom
    }

    // TODO: fishing transferred money out? (maybe all transfers into malloc should only be via ft_transfer_call and there should be the recipient account in the message! (this way you do not worry)
    // The whole gas debocle may require having extra deposits to make up for GAS and having the contract pay for GAS from the deposits
    /// handle_splits handles a split by returning a promise for when all the splits are done
    /// handle_splits assumes a well formed splitter, so splitter len > 0, thus the unwrap is ok as
    /// prior_prom should only be null when i = 0
    fn handle_splits(
        &mut self,
        splitter: &Splitter,
        amount_deposited: u128,
        construction_call_id: &ConstructionCallDataId,
        splitter_call_id: SplitterCallId,
        splitter_idx: u64,
        mut splitter_call: SplitterCall,
        caller: &AccountId,
    ) -> Result<(u64, SplitterCall), String> {
        let mut split_sum = 0;
        for i in 0..splitter.splits.0.len() {
            split_sum += splitter.splits.0.get(i).unwrap();
        }

        let mut proms = vec![];
        for i in 0..splitter.children.0.len() {
            // unwrap does not need to be checked as splits's len equalling children's len is an invariant
            // of the construction and i never exceeds the children's length
            let frac = (splitter.splits.0.get(i).unwrap() as f64) / (split_sum as f64);
            let transfer_amount_float = frac * amount_deposited as f64;
            let transfer_amount = transfer_amount_float.floor() as u128;
            log!(
                "transferring {} rounded from {}",
                transfer_amount,
                transfer_amount_float
            );
            let (prom, new_splitter_call)= self.handle_node(
                transfer_amount,
                splitter.children.0.get(i).unwrap(),
                &splitter.ft_contract_id,
                &construction_call_id,
                splitter_call_id,
                splitter_idx,
                splitter_call,
                i,
                &caller,
            )?;
            splitter_call = new_splitter_call;
            proms.push(prom);
        }
        Ok((env::promise_and(&proms), splitter_call))
    }

    // TODO: split up into helper functions
    // TODO: how to make sure all one input token type for a splitter?
    fn handle_node(
        &mut self,
        amount: u128,
        endpoint: Node,
        token_id: &AccountId,
        construction_call_id: &ConstructionCallDataId,
        splitter_call_id: SplitterCallId,
        splitter_idx: u64,
        mut splitter_call: SplitterCall,
        node_idx: u64,
        caller: &AccountId,
    ) -> Result<(u64, SplitterCall), String> {
                // Set the child's status in the splitter call
                splitter_call.children_status.0.replace(node_idx, &NodeCallStatus::Executing {block_index_start: env::block_index()});
        match endpoint {
            Node::MallocCall {
                contract_id,
                json_args,
                attached_amount,
                check_callback,
                gas,
            } => {
                // TODO: we need a smart way of doing gas for these wcalls...
                // Maybe each could have metadata or something
                // TODO: seperate fn
                let token_contract_id = token_id.clone();
                let call_data = format!(
                    "{{\"args\": {}, \"amount\": \"{}\", \"token_id\": \"{}\", \"caller\": \"{}\"}}",
                    json_args,
                    amount.to_string(),
                    token_contract_id.clone(),
                    caller
                );

                // TODO: is this wrong???
                let call_prom = if amount > 0 {
                    // self.balances.subtract_contract_bal_from_user(caller, token_contract_id.clone(), amount);
                    // TODO: what if the ft_transfer prom fails???
                    // TODO: the malloc call (next on the line) has to check that the prior promise resolved
                    let transfer_call_prom = self.balances.internal_ft_transfer_call(&token_id, contract_id.clone(), amount.to_string(), caller.clone(), None);
                     
                    let call_prom = env::promise_then(
                        transfer_call_prom,
                        contract_id,
                        &malloc_call_core::call_method_name(),
                        call_data.as_bytes(),
                        attached_amount.into(),
                        gas,
                    );
                    call_prom
                } else {
                    let call_prom= env::promise_batch_create(contract_id);
                    env::promise_batch_action_function_call(call_prom, &malloc_call_core::call_method_name(), call_data.as_bytes(), attached_amount.into(), gas);
                    call_prom
                };

                // If check callback is false, finish the call and return
                if let Some(check_cb) = check_callback {
                    if !check_cb {
                        return Ok((call_prom, splitter_call));
                    }
                }

                let callback = env::promise_batch_then(call_prom, env::current_account_id());
                let callback_args = json!({ 
                    "splitter_call_id": splitter_call_id,
                "construction_call_id": construction_call_id,
                "splitter_idx": splitter_idx, "node_idx": node_idx, "caller": caller });
                env::promise_batch_action_function_call(
                    callback,
                    b"handle_node_callback",
                    callback_args.to_string().as_bytes(),
                    0,
                    CALLBACK_GAS,
                );
                Ok((callback, splitter_call))
            }
        }
    }
}