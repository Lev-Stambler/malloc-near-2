use near_sdk::collections::UnorderedMap;
use near_sdk::{collections::Vector, AccountId};
use near_sdk::{env, near_bindgen, serde, setup_alloc, Gas, PanicOnDefault, Promise};

use crate::{Construction, ConstructionId, Contract, Splitter, SplitterId};

impl Contract {
    pub(crate) fn delete_construction(&mut self, construction_id: ConstructionId) {
        todo!()
    }

    pub(crate) fn store_construction(
        &mut self,
        name: String,
        construction: &Construction,
        owner: Option<AccountId>,
    ) -> ConstructionId {
        let owner = owner.unwrap_or(env::predecessor_account_id());
        let mut constructions_by_account = self.constructions.get(&owner);
        let (constructions, idx) = match constructions_by_account {
            None => {
                let mut constructions =
                    UnorderedMap::new(format!("{}-construction", owner).as_bytes());
                constructions.insert(&name, construction);
                let len = constructions.len();
                (constructions, len - 1)
            }
            Some(mut constructions) => {
                constructions.insert(&name, &construction);
                let len = constructions.len();
                (constructions, len - 1)
            }
        };
        self.constructions.insert(&owner, &constructions);

        ConstructionId { owner: owner, name }
    }

    pub(crate) fn store_splitter(&mut self, splitter: &Splitter) -> SplitterId {
        let splitters_by_account = self.splitters.get(&env::predecessor_account_id());
        let (splitters, idx) = match splitters_by_account {
            None => {
                let mut splitters =
                    Vector::new(format!("{}-splitters", env::predecessor_account_id()).as_bytes());
                splitters.push(splitter);
                let len = splitters.len();
                (splitters, len - 1)
            }
            Some(mut splitters) => {
                splitters.push(&splitter);
                let len = splitters.len();
                (splitters, len - 1)
            }
        };
        self.splitters
            .insert(&env::predecessor_account_id(), &splitters);
        SplitterId {
            owner: env::predecessor_account_id(),
            index: idx,
        }
    }
}