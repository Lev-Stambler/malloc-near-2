use core::panic;
use std::string;

use near_sdk::{
    bs58::alphabet::Error,
    env, log,
    serde_json::{self, json},
    AccountId, Promise,
};

use crate::{
    errors::Errors, handle_not_found, serde_ext::VectorWrapper, splitter, Construction,
    ConstructionCallData, ConstructionCallDataId, ConstructionId, ConstructionNextSplitters,
    Contract, Node, NodeCallStatus, Splitter, SplitterCall, SplitterCallId, SplitterId, BASIC_GAS,
    CALLBACK_GAS,
};

impl Contract {
    pub(crate) fn handle_node_callback_internal(
        &mut self,
        construction_call_id: ConstructionCallDataId,
        splitter_call_id: SplitterCallId,
        splitter_idx: u64,
        node_idx: u64,
        caller: AccountId,
    ) -> Option<u64> {
        let mut construction_call = self.get_construction_call_unchecked(&construction_call_id);
        let construction_res = self.get_construction(&construction_call.construction_id);
        let construction = handle_not_found!(
            self,
            construction_res,
            construction_call_id,
            splitter_call_id,
            node_idx,
            construction_call
        );

        let next_splitter_set_res = construction
            .next_splitters
            .0
            .get(splitter_idx)
            .ok_or(Errors::NEXT_SPLITTER_SET_NOT_FOUND_PER_SPLITTER.to_string());

        let next_splitter_set = handle_not_found!(
            self,
            next_splitter_set_res,
            construction_call_id,
            splitter_call_id,
            node_idx,
            construction_call
        );

        // The set of next splitters indexes to be called after the called splitter's (referenced by splitter_idx) child (referenced by node_idx) completes.
        let next_splitters_idx_res = next_splitter_set
            .0
            .get(node_idx)
            .ok_or(Errors::NEXT_SPLITTER_SET_NOT_FOUND_PER_SPLITTER.to_string());
        let next_splitters_idx = handle_not_found!(
            self,
            next_splitters_idx_res,
            construction_call_id,
            splitter_call_id,
            node_idx,
            construction_call
        );

        // The set of next splitters to be called after the called splitter's (referenced by splitter_idx) child (referenced by node_idx) completes.
        let mut next_splitters: Vec<Splitter> = vec![];
        for i in 0..next_splitters_idx.0.len() {
            let splitter_id_res = construction
                .splitters
                .0
                .get(next_splitters_idx.0.get(i).unwrap()) // You can unwrap safely here as you know that i is from 0 to next_splitter_idx.len
                .ok_or(Errors::SPLITTER_NOT_FOUND_IN_CONSTRUCTION.to_string());

            let splitter_id = handle_not_found!(
                self,
                splitter_id_res,
                construction_call_id,
                splitter_call_id,
                node_idx,
                construction_call
            );

            let splitter_res = self.get_splitter(&splitter_id);
            let splitter = handle_not_found!(
                self,
                splitter_res,
                construction_call_id,
                splitter_call_id,
                node_idx,
                construction_call
            );

            next_splitters.push(splitter);
        }

        let ret = near_sdk::utils::promise_result_as_success();
        let mut construction_call = match ret {
            // The callback errored
            None => Self::resolve_splitter_call(
                construction_call,
                NodeCallStatus::Error {
                    message: Errors::MALLOC_CALL_FAILED.to_string(),
                },
                splitter_call_id,
                node_idx,
            ),
            Some(ret_serial) => {
                let ret: Result<Vec<malloc_call_core::ReturnItem>, near_sdk::serde_json::Error> =
                    serde_json::from_slice(&ret_serial);

                match ret {
                    Ok(ret) => {
                        // Set the splitter call to successful
                        let mut construction_call = Self::resolve_splitter_call(
                            construction_call,
                            NodeCallStatus::Success,
                            splitter_call_id,
                            node_idx,
                        );

                        // Add the next set of splitters to the call stack so that Malloc Client knows
                        // what to call next
                        self.add_next_splitters_to_call_stack(
                            construction_call,
                            ret,
                            &next_splitters,
                            &construction_call_id,
                            &next_splitters_idx,
                            splitter_call_id,
                            node_idx,
                        )
                    }
                    Err(e) => Self::resolve_splitter_call(
                        construction_call,
                        NodeCallStatus::Error {
                            message: format!("Error deserializing result: {}", e),
                        },
                        splitter_call_id,
                        node_idx,
                    ),
                }
            }
        };
        self.construction_calls
            .insert(&construction_call_id, &construction_call);
        None
    }

    pub(crate) fn resolve_splitter_call(
        mut construction_call: ConstructionCallData,
        status: NodeCallStatus,
        splitter_call_id: SplitterCallId,
        child_index: u64,
    ) -> ConstructionCallData {
        // If the following panics, then there is no way to register on chain that the call failed
        let mut splitter_call = construction_call
            .splitter_calls
            .0
            .get(splitter_call_id)
            .unwrap_or_else(|| panic!(Errors::CONSTRUCTION_CALL_SPLITTER_CALL_NOT_FOUND));
        splitter_call
            .children_status
            .0
            .replace(child_index, &status);
        construction_call
            .splitter_calls
            .0
            .replace(splitter_call_id, &splitter_call);
        construction_call
    }

    pub(crate) fn add_next_splitters_to_call_stack(
        &self,
        mut construction_call: ConstructionCallData,
        result: Vec<malloc_call_core::ReturnItem>,
        splitters: &[Splitter],
        construction_call_id: &ConstructionCallDataId,
        splitter_idxs: &VectorWrapper<u64>,
        prior_splitter_call_id: SplitterCallId,
        prior_child_index: u64,
    ) -> ConstructionCallData {
        if result.len() == 0 {
            return construction_call;
        }
        if splitters.len() != splitter_idxs.0.len() as usize {
            let err = NodeCallStatus::Error {
                message: Errors::NUMB_OF_SPLITTER_IDXS_DID_NOT_MATCH_SPLITTERS.to_string(),
            };
            return Self::resolve_splitter_call(
                construction_call,
                err,
                prior_splitter_call_id,
                prior_child_index,
            );
        }
        if result.len() != splitters.len() {
            let err = NodeCallStatus::Error {
                message: Errors::NUMBER_OF_SPLITTERS_DID_NOT_MATCH_RETURN.to_string(),
            };
            return Self::resolve_splitter_call(
                construction_call,
                err,
                prior_splitter_call_id,
                prior_child_index,
            );
        }

        for i in 0..splitters.len() {
            if splitters[i].ft_contract_id != result[i].token_id.to_string() {
                panic!(Errors::FT_CONTRACT_ID_NOT_MATCH)
            }
            let amount = result[i]
                .amount
                .parse()
                .unwrap_or_else(|_| panic!(Errors::FAILED_TO_PARSE_NUMBER));

            let splitter_call = self.create_splitter_call(
                &splitters[i],
                splitter_idxs.0.get(i as u64).unwrap(),
                amount,
                &construction_call_id,
                construction_call.splitter_calls.0.len(),
            );

            match splitter_call {
                Err(e) => {
                    return Self::resolve_splitter_call(
                        construction_call,
                        NodeCallStatus::Error { message: e },
                        prior_splitter_call_id,
                        prior_child_index,
                    )
                }
                Ok(splitter_call) => {
                    let call_elem_id = construction_call.splitter_calls.0.len();
                    construction_call.splitter_calls.0.push(&splitter_call);
                    construction_call
                        .next_splitter_call_stack
                        .0
                        .push(&call_elem_id);
                }
            }
        }
        construction_call
    }
}
