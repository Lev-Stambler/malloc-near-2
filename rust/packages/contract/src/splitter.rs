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
    pub(crate) fn _run(&mut self, splitter: Splitter, amount: u128) -> (Promise, u128) {
        let numb_endpoints = splitter.children.len();
        if numb_endpoints < 1 {
            throw_err(Errors::NoEndpointsSpecified);
        }
        let (ret_prom, amount_used) = self.handle_splits(&splitter, None, 0, amount, 0);

        if amount_used > amount {
            throw_err(Errors::MoreUsedThanAllowed);
        }
        (ret_prom, amount - amount_used)
    }

    /// handle_splits handles a split by returning a promise for when all the splits are done
    /// handle_splits assumes a well formed splitter, so splitter len > 0, thus the unwrap is ok as
    /// prior_prom should only be null when i = 0
    fn handle_splits(
        &mut self,
        splitter: &Splitter,
        prior_prom: Option<Promise>,
        amount_used: u128,
        amount_deposited: u128,
        i: u64,
    ) -> (Promise, u128) {
        if i == splitter.splits.len() {
            return (prior_prom.unwrap(), amount_used);
        }
        let frac = (splitter.splits.get(i).unwrap() as f64) / (splitter.split_sum as f64);
        let transfer_amount_float = frac * amount_deposited as f64;
        let transfer_amount = transfer_amount_float.floor() as u128;
        log!(
            "transferring {} rounded from {}",
            transfer_amount,
            transfer_amount_float
        );
        let prom = self.handle_endpoint(
            transfer_amount,
            splitter.children.get(i).unwrap(),
            &splitter.ft_contract_id,
        );
        let next_prom = match prior_prom {
            Some(p) => prom.and(p),
            None => prom,
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
    fn handle_endpoint(
        &mut self,
        amount: u128,
        endpoint: Node,
        token_contract_id: &AccountId,
    ) -> Promise {
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
                let ft_transfer_method_name = "ft_transfer".to_string().into_bytes();
                let token_contract_id = token_contract_id.clone();
                let transfer_data =
                    Self::get_transfer_data(contract_id.clone(), amount.to_string());
                let wcall_data = format!(
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
                Promise::new(token_contract_id)
                    .function_call(ft_transfer_method_name, transfer_data, 1, BASIC_GAS)
                    .then(Promise::new(contract_id).function_call(
                        "wcall".to_string().into_bytes(),
                        wcall_data.into_bytes(),
                        attached_amount.into(),
                        gas,
                    ))
            }
        }
    }
}
