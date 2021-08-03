use near_sdk::{env, log, serde_json::json, AccountId, Promise};

use crate::{
    errors::{throw_err, Errors},
    Contract, Node, Splitter, BASIC_GAS,
};

impl Contract {
    fn get_transfer_data(recipient: String, amount: String) -> Vec<u8> {
        json!({ "receiver_id": recipient, "amount": amount, "msg": ""})
            .to_string()
            .into_bytes()
    }

    /// This call on _run assumes a well formed splitter
    /// Returns a refunded amount
    pub(crate) fn _run(&mut self, splitter: Splitter, amount: u128) -> u64 {
        let numb_endpoints = splitter.children.len();
        if numb_endpoints < 1 {
            throw_err(Errors::NoEndpointsSpecified);
        }
        let ret_prom = self.handle_splits(&splitter, None, 0, amount, 0);

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
        prior_prom: Option<u64>,
        amount_used: u128,
        amount_deposited: u128,
        i: u64,
    ) -> u64 {
        if i == splitter.splits.len() {
            return prior_prom.unwrap();
        }
        let frac = (splitter.splits.get(i).unwrap() as f64) / (splitter.split_sum as f64);
        let transfer_amount_float = frac * amount_deposited as f64;
        let transfer_amount = transfer_amount_float.floor() as u128;
        log!(
            "transferring {} rounded from {}",
            transfer_amount,
            transfer_amount_float
        );
        let handle_node_prom = self.handle_node(
            transfer_amount,
            splitter.children.get(i).unwrap(),
            &splitter.ft_contract_id,
        );
        let next_prom = match prior_prom {
            Some(p) => env::promise_and(&vec![p, handle_node_prom]),
            None => handle_node_prom,
        };
        self.handle_splits(
            splitter,
            Some(next_prom),
            amount_used + transfer_amount,
            amount_deposited,
            i + 1,
        )
    }

    // TODO: how to make sure all one input token type for a splitter?
    fn handle_node(&mut self, amount: u128, endpoint: Node, token_contract_id: &AccountId) -> u64 {
        match endpoint {
            // Node::SimpleTransfer { recipient } => Promise::new(recipient).transfer(amount),
            // Node::FTTransfer { recipient } => {
            //     let ft_transfer_method_name = "ft_transfer".to_string().into_bytes();
            //     let transfer_data = Self::get_transfer_data(recipient, amount.to_string());

            //     self.subtract_contract_bal_from_user(
            //         env::predecessor_account_id(),
            //         token_contract_id.clone().unwrap(),
            //         amount,
            //     );
            //     Promise::new(token_contract_id.clone().unwrap()).function_call(
            //         ft_transfer_method_name,
            //         transfer_data,
            //         1,
            //         BASIC_GAS,
            //     )
            // }
            Node::MallocCall {
                contract_id,
                json_args,
                attached_amount,
                gas,
                next_spitters,
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
                self.subtract_contract_bal_from_user(
                    env::predecessor_account_id(),
                    token_contract_id.clone(),
                    amount,
                );
                // TODO: use resolve to get the results, then pass results into handle_into_next_split
                // TODO: have the handle node merge together the array of children proms
                let prom_transfer = env::promise_batch_create(token_contract_id);
                env::promise_batch_action_function_call(
                    prom_transfer,
                    ft_transfer_method_name.as_bytes(),
                    &transfer_data,
                    1,
                    BASIC_GAS,
                );
                let call_prom = env::promise_then(
                    prom_transfer,
                    contract_id,
                    &malloc_call_core::call_method_name(),
                    call_data.as_bytes(),
                    attached_amount.into(),
                    gas,
                );
                let callback = env::promise_batch_then(call_prom, env::current_account_id());
                env::promise_batch_action_function_call(
                    callback,
                    b"handle_malloc_call_return",
                    b"{}",
                    0,
                    BASIC_GAS,
                );
                // env::promise_return(callback);
                callback
                // Promise::new(token_contract_id)
                //     .function_call(ft_transfer_method_name, transfer_data, 1, BASIC_GAS)
                //     .then(Promise::new(contract_id).function_call(
                //         "wcall".to_string().into_bytes(),
                //         call_data.into_bytes(),
                //         attached_amount.into(),
                //         gas,
                //     ))
            }
        }
    }

    pub(crate) fn handle_into_next_split(
        &mut self,
        result: Vec<malloc_call_core::ReturnItem>,
        splitters: &[Splitter],
        prior_prom: Option<u64>,
        i: usize,
    ) -> Option<u64> {
        if result.len() == 0 {
            return prior_prom;
        }
        if splitters[i].ft_contract_id != result[i].token_id.to_string() {
            panic!(Errors::FTContractIdNotMatch.to_string())
        }
        let handle_splits_prior = if i == 0 {
            None
        } else {
            Some(prior_prom.unwrap())
        };
        let next_prom = self.handle_splits(
            &splitters[i],
            handle_splits_prior,
            0,
            result[i]
                .amount
                .parse()
                .unwrap_or_else(|_| panic!(Errors::FailedToParseNumber.to_string())),
            0,
        );

        if i == result.len() - 1 {
            return Some(next_prom);
        }

        self.handle_into_next_split(result, splitters, Some(next_prom), i + 1)
    }
}
