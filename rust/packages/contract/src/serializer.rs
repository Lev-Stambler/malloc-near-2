use crate::{
    errors::{throw_err, Errors},
    Contract, SerializedSplitter, Splitter,
};
use near_sdk::{borsh::BorshSerialize, collections::Vector, env};

impl Contract {
    pub(crate) fn deserialize(&self, splitter: SerializedSplitter, ephemeral: bool) -> Splitter {
        if splitter.splits.len() != splitter.nodes.len() {
            throw_err(Errors::NumbEndpointsDneNumbSplits);
        }
        let owner = env::predecessor_account_id();
        let split_idx = self.splitters.get(&owner).map(|vec| vec.len()).unwrap_or(0);
        let prefix_base = format!(
            "{}:{}:{}",
            owner,
            split_idx,
            if ephemeral { "ephemeral" } else { "permanent" }
        );
        let node_prefix = format!("{}-nodes", prefix_base);
        let splits_prefix = format!("{}-splits", prefix_base);
        let split_sum = splitter.splits.iter().fold(0, |a, b| a + *b);
        Splitter {
            split_sum: split_sum,
            endpoints: Contract::vec_to_vector(splitter.nodes, node_prefix.as_bytes()),
            splits: Contract::vec_to_vector(splitter.splits, splits_prefix.as_bytes()),
            owner,
            ft_contract_id: splitter.ft_contract_id,
        }
    }

    fn check_splits(expected_sum: u128, splits: &[u128]) -> bool {
        let split_sum = splits.iter().fold(0, |acc, x| acc + x);
        if split_sum != expected_sum {
            return false;
        }
        true
    }

    pub(crate) fn vec_to_vector<T: BorshSerialize>(v: Vec<T>, prefix: &[u8]) -> Vector<T> {
        let mut vector = Vector::new(prefix);
        for i in v.iter() {
            vector.push(i);
        }
        vector
    }
}
