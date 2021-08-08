use core::panic;

use near_sdk::{AccountId, Promise, bs58::alphabet::Error, env, log, serde_json::json};

use crate::{BASIC_GAS, CALLBACK_GAS, Construction, ConstructionCallData, ConstructionCallDataId, ConstructionId, ConstructionNextSplitters, Contract, Node, Splitter, SplitterCall, SplitterCallStatus, SplitterId, errors::{Errors}, handle_not_found, serde_ext::VectorWrapper};

impl Contract {
    fn get_transfer_data(recipient: String, amount: String) -> Vec<u8> {
        json!({ "receiver_id": recipient, "amount": amount, "msg": ""})
            .to_string()
            .into_bytes()
    }

    /// This call on _run assumes a well formed splitter
    /// Returns a refunded amount
    pub(crate) fn _run_step(
        &mut self,
        construction_call_id: ConstructionCallDataId,
    ) -> u64 {
        let mut construction_call = self.get_construction_call_unchecked(&construction_call_id);

        let splitter_call_id = construction_call.next_splitter_call_stack.0.pop().unwrap_or_else(|| panic!(Errors::CONSTRUCTION_CALL_SPLITTER_STACK_EMPTY));
        let mut splitter_call = construction_call.splitter_calls.0.get(splitter_call_id).unwrap_or_else(|| panic!(Errors::CONSTRUCTION_CALL_SPLITTER_CALL_NOT_FOUND));

        let construction_res = self.get_construction(&construction_call.construction_id);
        let construction = handle_not_found!(self, construction_res, construction_call_id, splitter_call_id, construction_call);

        let splitter_id_res = construction.splitters.0.get(splitter_call.splitter_index).ok_or(Errors::SPLITTER_NOT_FOUND_IN_CONSTRUCTION.to_string());
        let splitter_id = handle_not_found!(self, splitter_id_res, construction_call_id, splitter_call_id, construction_call);

        let splitter_res = self.get_splitter(&splitter_id);
        let splitter = handle_not_found!(self, splitter_res, construction_call_id, splitter_call_id, construction_call);

         let call_ret = self.handle_splits(
            &splitter,
            splitter_call.amount,
            &construction_call_id,
            splitter_call_id,
            splitter_call.splitter_index,
            &env::predecessor_account_id(),
        );


        if let Some(err) = call_ret.clone().err() {
            splitter_call.status = SplitterCallStatus::Error {
                message: err.to_string()
            };
        } else {
        // Set the call's execution status to executing
        splitter_call.status = SplitterCallStatus::Executing {
            block_index_start: env::block_index()
        };
        }
        construction_call.splitter_calls.0.replace(splitter_call_id, &splitter_call);

        // Update the construction call to include the new stack and status
        self.construction_calls
            .insert(&construction_call_id, &construction_call);

        log!("Gas used for this run step: {}", env::used_gas());
        call_ret.unwrap_or_else(|e| panic!(&e))
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
        splitter_call_id: u64,
        splitter_idx: u64,
        caller: &AccountId,
    ) -> Result<u64, String> {
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
            let prom = self.handle_node(
                transfer_amount,
                splitter.children.0.get(i).unwrap(),
                &splitter.ft_contract_id,
                &construction_call_id,
                splitter_call_id,
                splitter_idx,
                i,
                &caller,
            )?;
            proms.push(prom);
        }
        Ok(env::promise_and(&proms))
    }

    // TODO: split up into helper functions
    // TODO: how to make sure all one input token type for a splitter?
    fn handle_node(
        &mut self,
        amount: u128,
        endpoint: Node,
        token_contract_id: &AccountId,
        construction_call_id: &ConstructionCallDataId,
        splitter_call_id: u64,
        splitter_idx: u64,
        node_idx: u64,
        caller: &AccountId,
    ) -> Result<u64, String> {
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
                let ft_transfer_method_name = "ft_transfer";
                let token_contract_id = token_contract_id.clone();
                let transfer_data =
                    Self::get_transfer_data(contract_id.clone(), amount.to_string());

                let call_data = format!(
                    "{{\"args\": {}, \"amount\": \"{}\", \"token_contract\": \"{}\"}}",
                    json_args,
                    amount.to_string(),
                    token_contract_id.clone()
                );

                let call_prom = if amount > 0 {
                    self.subtract_contract_bal_from_user(caller, token_contract_id.clone(), amount);
                    let prom_batch = env::promise_batch_create(token_contract_id);
                    // TODO: what if the ft_transfer prom fails???
                    env::promise_batch_action_function_call(
                        prom_batch,
                        ft_transfer_method_name.as_bytes(),
                        &transfer_data,
                        1,
                        BASIC_GAS,
                    );
                    // TODO: should the initial promise batch be returned or the call prom????
                    let call_prom = env::promise_then(
                        prom_batch,
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
                        return Ok(call_prom);
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
                Ok(callback)
            }
        }
    }

    pub(crate) fn resolve_splitter_call(mut construction_call: ConstructionCallData, status: SplitterCallStatus, splitter_call_id: u64)-> ConstructionCallData{
        // If the following panics, then there is no way to register on chain that the call failed
        let mut splitter_call = construction_call.splitter_calls.0.get(splitter_call_id).unwrap_or_else(|| panic!(Errors::CONSTRUCTION_CALL_SPLITTER_CALL_NOT_FOUND));
        splitter_call.status = status;
        construction_call.splitter_calls.0.replace(splitter_call_id, &splitter_call);
        construction_call
    }

    pub(crate) fn add_to_splitter_call_stack(
        mut construction_call: ConstructionCallData,
        result: Vec<malloc_call_core::ReturnItem>,
        splitters: &[Splitter],
        splitter_idxs: &VectorWrapper<u64>,
        splitter_call_id: u64,
     ) -> ConstructionCallData {
        if result.len() == 0 {
            return construction_call;
        }
        if splitters.len() != splitter_idxs.0.len() as usize {
            let err = SplitterCallStatus::Error {message: Errors::NUMB_OF_SPLITTER_IDXS_DID_NOT_MATCH_SPLITTERS.to_string() };
            return Self::resolve_splitter_call(construction_call, err, splitter_call_id);
        }
        if result.len() != splitters.len() {
            let err = SplitterCallStatus::Error {message: Errors::NUMBER_OF_SPLITTERS_DID_NOT_MATCH_RETURN.to_string() };
            return Self::resolve_splitter_call(construction_call, err, splitter_call_id);
        }

        for i in 0..splitters.len() {
            if splitters[i].ft_contract_id != result[i].token_id.to_string() {
                panic!(Errors::FT_CONTRACT_ID_NOT_MATCH)
            }
            let amount = result[i]
                .amount
                .parse()
                .unwrap_or_else(|_| panic!(Errors::FAILED_TO_PARSE_NUMBER));

        // TODO: a
            let call_elem = SplitterCall {
                splitter_index: splitter_idxs.0.get(i as u64).unwrap(),
                block_index: env::block_index(),
                status: crate::SplitterCallStatus::WaitingCall,
                amount
            };
            let call_elem_id = construction_call.splitter_calls.0.len();
            construction_call.splitter_calls.0.push(&call_elem);
            construction_call.next_splitter_call_stack.0.push(&call_elem_id);
        }
        construction_call
    }
}
