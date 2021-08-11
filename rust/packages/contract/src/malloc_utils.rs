use near_sdk::{
    collections::Vector,
    env::{self, random_seed},
    near_bindgen, AccountId,
};

use crate::{Construction, ConstructionCall, ConstructionCallId, ConstructionId, ConstructionNextSplitters, Contract, NodeCallStatus, Splitter, SplitterCall, SplitterCallId, SplitterId, errors::{Errors, MallocError}, serde_ext::VectorWrapper};

#[macro_export]
macro_rules! handle_not_found {
    ($self:expr, $res:expr, $construction_call_id:expr, $splitter_call_id:expr, $child_index:expr, $constr_call:expr) => {{
        match $res {
            Ok(c) => c,
            Err(e) => {
                $constr_call = $self.handle_not_found::<ConstructionCallData>(
                    e,
                    &$construction_call_id,
                    $splitter_call_id,
                    $child_index,
                    $constr_call,
                );
                panic!("");
            }
        }
    }};
}

impl Contract {
    // pub(crate) fn create_construction(
    //     &mut self,
    //     splitters: Vec<Splitter>,
    //     next_splitters: ConstructionNextSplitters,
    // ) -> Construction {
    //     // TODO: checks that the splitters len is next splitters len?
    //     let mut splitter_ids = VectorWrapper(Vector::new(random_seed()));
    //     for i in 0..splitters.len() {
    //         self.check_splitter(&splitters[i]);
    //         // TODO: make this more efficient by making store_splitters a fn which stores them in bulk
    //         splitter_ids.0.push(&self.store_splitter(&splitters[i]));
    //     }
    //     Construction {
    //         splitters: splitter_ids,
    //         next_splitters,
    //     }
    // }

    pub(crate) fn create_splitter_call(
        &self,
        splitter: &Splitter,
        splitter_index_in_construction: u64,
        amount: u128,
        construction_call_id: &ConstructionCallId,
        splitter_call_id: SplitterCallId,
    ) -> Result<SplitterCall, String> {
        let vect_prefix_str = format!(
            "{}-{}-splittercall-stats",
            construction_call_id, splitter_call_id
        );
        let mut children_status = VectorWrapper::new(vect_prefix_str.as_bytes());

        for i in 0..splitter.children.0.len() {
            children_status.0.push(&NodeCallStatus::WaitingCall);
        }

        Ok(SplitterCall {
            splitter_index: splitter_index_in_construction,
            amount,
            block_index: env::block_index(),
            children_status,
        })
    }

    pub(crate) fn handle_not_found<ReturnType>(
        &mut self,
        error: String,
        construction_call_id: &ConstructionCallId,
        splitter_call_id: SplitterCallId,
        child_index: u64,
        construction_call: ConstructionCall,
    ) -> ReturnType {
        let construction_call = Self::resolve_splitter_call(
            construction_call,
            NodeCallStatus::Error {
                message: error.clone(),
            },
            splitter_call_id,
            child_index,
        );
        self.construction_calls
            .insert(&construction_call_id, &construction_call);
        panic!("{}", error)
    }

    pub(crate) fn get_splitter(&self, id: &SplitterId) -> Result<Splitter, String> {
        self.splitters
            .get(&id.owner)
            .ok_or(Errors::SPLITTER_OWNER_NOT_FOUND.to_string())?
            .get(id.index)
            .ok_or(Errors::SPLITTER_NOT_FOUND.to_string())
    }

}
