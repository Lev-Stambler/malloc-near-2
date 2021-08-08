use near_sdk::{collections::Vector, env::random_seed, near_bindgen};

use crate::{Construction, ConstructionCallData, ConstructionCallDataId, ConstructionId, ConstructionNextSplitters, Contract, Splitter, SplitterCallStatus, SplitterId, errors::Errors, serde_ext::VectorWrapper};

#[macro_export]
macro_rules! handle_not_found {
    ($self:expr, $res:expr, $construction_call_id:expr, $splitter_call_id:expr, $constr_call:expr) => {{
        match $res {
            Ok(c) => c,
            Err(e) => {
                $constr_call = $self.handle_not_found::<ConstructionCallData>(
                    e,
                    &$construction_call_id,
                    $splitter_call_id,
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

    pub(crate) fn handle_not_found<ReturnType>(
        &mut self,
        error: String,
        construction_call_id: &ConstructionCallDataId,
        splitter_call_id: u64,
        construction_call: ConstructionCallData,
    ) -> ReturnType {
        let construction_call = Self::resolve_splitter_call(
            construction_call,
            SplitterCallStatus::Error {
                message: error.clone(),
            },
            splitter_call_id,
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
