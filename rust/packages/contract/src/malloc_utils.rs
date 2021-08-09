use near_sdk::{
    collections::Vector,
    env::{self, random_seed},
    near_bindgen, AccountId,
};

use crate::{
    errors::Errors, serde_ext::VectorWrapper, Construction, ConstructionCallData,
    ConstructionCallDataId, ConstructionId, ConstructionNextSplitters, Contract, NodeCallStatus,
    Splitter, SplitterCall, SplitterCallId, SplitterId,
};

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
    pub(crate) fn create_construction(
        &mut self,
        splitters: Vec<Splitter>,
        next_splitters: ConstructionNextSplitters,
    ) -> Construction {
        // TODO: checks that the splitters len is next splitters len?
        let mut splitter_ids = VectorWrapper(Vector::new(random_seed()));
        for i in 0..splitters.len() {
            self.check_splitter(&splitters[i]);
            // TODO: make this more efficient by making store_splitters a fn which stores them in bulk
            splitter_ids.0.push(&self.store_splitter(&splitters[i]));
        }
        Construction {
            splitters: splitter_ids,
            next_splitters,
        }
    }

    pub(crate) fn create_splitter_call(
        &self,
        splitter: &Splitter,
        splitter_index_in_construction: u64,
        amount: u128,
        construction_call_id: &ConstructionCallDataId,
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

    /// Create a construction call
    /// Note: this adds the 0th index splitter to the splitter call list and the call stack
    pub(crate) fn create_construction_call(
        &self,
        caller: AccountId,
        construction_id: ConstructionId,
        construction_call_id: &ConstructionCallDataId,
        amount: u128,
    ) -> Result<ConstructionCallData, String> {
        let construction = self.get_construction(&construction_id)?;
        let splitter_index = 0;
        let vect_prefix_str_splitter_stack = format!("constcall-stack-{}", construction_call_id);
        let vect_prefix_splitter_call_stack = vect_prefix_str_splitter_stack.as_bytes();

        let vect_prefix_str_splitter_call = format!("constcall-{}", construction_call_id.clone());
        let vect_prefix_splitter_call = vect_prefix_str_splitter_call.as_bytes();

        let mut splitter_calls = VectorWrapper(Vector::new(vect_prefix_splitter_call));

        let splitter_id = construction
            .splitters
            .0
            .get(splitter_index)
            .ok_or(Errors::SPLITTER_NOT_FOUND_IN_CONSTRUCTION)?;
        let first_splitter = self.get_splitter(&splitter_id)?;
        let first_splitter_call = self.create_splitter_call(
            &first_splitter,
            splitter_index,
            amount,
            &construction_call_id,
            0,
        )?;
        splitter_calls.0.push(&first_splitter_call);

        let mut splitter_call_stack = VectorWrapper(Vector::new(vect_prefix_splitter_call_stack));
        // Add the first element (and only) in splitter calls to the call stack
        splitter_call_stack.0.push(&0);

        Ok(ConstructionCallData {
            caller,
            construction_id,
            splitter_calls,
            next_splitter_call_stack: splitter_call_stack,
        })
    }

    pub(crate) fn handle_not_found<ReturnType>(
        &mut self,
        error: String,
        construction_call_id: &ConstructionCallDataId,
        splitter_call_id: SplitterCallId,
        child_index: u64,
        construction_call: ConstructionCallData,
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

    pub fn get_construction(&self, id: &ConstructionId) -> Result<Construction, String> {
        self.constructions
            .get(&id.owner)
            .ok_or(Errors::CONSTRUCTION_OWNER_NOT_FOUND.to_string())?
            .get(&id.name)
            .ok_or(Errors::CONSTRUCTION_NOT_FOUND.to_string())
    }
}
