use near_sdk::{env, log, serde_json::json, AccountId, Promise};

use crate::{BASIC_GAS, CALLBACK_GAS, Construction, ConstructionCallDataId, ConstructionId, ConstructionNextSplitters, Contract, Node, Splitter, SplitterCall, SplitterId, errors::{throw_err, Errors}, serde_ext::VectorWrapper};

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
        let call_data = construction_call.next_splitter_call_stack.0.pop().unwrap_or_else(|| panic!("TODO:"));
        let construction = self.get_construction_unchecked(&construction_call.construction_id);
        let first_splitter_id = construction.splitters.0.get(0).unwrap();
        let splitter = self.get_splitter_unchecked(&first_splitter_id);
        let ret_prom = self.handle_splits(
            &splitter,
            call_data.amount,
            &construction_call_id,
            call_data.splitter_index,
            &env::predecessor_account_id(),
        );

        // Update the call stack
        self.construction_calls
            .insert(&construction_call_id, &construction_call);

        log!("Gas used for this run step: {}", env::used_gas());
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
        splitter_idx: u64,
        caller: &AccountId,
    ) -> u64 {
        let mut split_sum = 0;
        for i in 0..splitter.splits.0.len() {
            split_sum += splitter.splits.0.get(i).unwrap();
        }

        let mut proms = vec![];
        for i in 0..splitter.children.0.len() {
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
                splitter_idx,
                i,
                &caller,
            );
            proms.push(prom);
        }
        env::promise_and(&proms)
    }

    // TODO: split up into helper functions
    // TODO: how to make sure all one input token type for a splitter?
    fn handle_node(
        &mut self,
        amount: u128,
        endpoint: Node,
        token_contract_id: &AccountId,
        construction_call_id: &ConstructionCallDataId,
        splitter_idx: u64,
        node_idx: u64,
        caller: &AccountId,
    ) -> u64 {
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
                        return call_prom;
                    }
                }

                let callback = env::promise_batch_then(call_prom, env::current_account_id());
                let callback_args = json!({ 
                "construction_call_id": construction_call_id,
                "splitter_idx": splitter_idx, "node_idx": node_idx, "caller": caller });
                env::promise_batch_action_function_call(
                    callback,
                    b"handle_node_callback",
                    callback_args.to_string().as_bytes(),
                    0,
                    CALLBACK_GAS,
                );
                callback
            }
        }
    }

    pub(crate) fn add_to_splitter_call_stack(&mut self,
        result: Vec<malloc_call_core::ReturnItem>,
        splitters: &[Splitter],
        splitter_idxs: &VectorWrapper<u64>,
        construction_call_id: &ConstructionCallDataId,
     ) {
        let mut construction_call= self.get_construction_call_unchecked(&construction_call_id);
        if result.len() == 0 {
            return;
        }
        if result.len() != splitters.len() {
            panic!("TODO:");
        }

        for i in 0..splitters.len() {
            if splitters[i].ft_contract_id != result[i].token_id.to_string() {
                panic!(Errors::FTContractIdNotMatch.to_string())
            }
            let amount = result[i]
                .amount
                .parse()
                .unwrap_or_else(|_| panic!(Errors::FailedToParseNumber.to_string()));
            let call_elem = SplitterCall {
                splitter_index: splitter_idxs.0.get(i as u64).unwrap(),
                block_index: env::block_index(),
                amount
            };
            construction_call.next_splitter_call_stack.0.push(&call_elem);
        }
        self.construction_calls.insert(&construction_call_id, &construction_call);
    }
}
