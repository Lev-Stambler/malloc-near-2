use crate::{
    errors::{throw_err, Errors},
    Contract, Node, SerializedNode, SerializedSplitter, Splitter,
};
use near_sdk::{borsh::BorshSerialize, collections::Vector, env};

impl Contract {
    pub(crate) fn deserialize_node(serialized: SerializedNode, prefix_base: &str) -> Node {
        let node_prefix = format!("{}-node", prefix_base);
        match serialized {
            SerializedNode::MallocCall {
                contract_id,
                json_args,
                attached_amount,
                gas,
                next_spitters,
            } => Node::MallocCall {
                contract_id,
                json_args,
                attached_amount: attached_amount.into(),
                gas,
                next_spitters: Contract::vec_to_vector(next_spitters, node_prefix.as_bytes()),
            },
        }
    }

    pub(crate) fn deserialize(&self, splitter: SerializedSplitter, ephemeral: bool) -> Splitter {
        if splitter.splits.len() != splitter.children.len() {
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

        let mut children_deserial = Vector::new(node_prefix.as_bytes());

        for i in 0..splitter.children.len() {
            children_deserial.push(&Contract::deserialize_node(
                splitter.children[i].clone(),
                &format!("node-child-{}", i),
            ));
        }

        Splitter {
            split_sum: split_sum,
            children: children_deserial,
            splits: Contract::vec_to_vector(splitter.splits, splits_prefix.as_bytes()),
            owner,
            ft_contract_id: splitter.ft_contract_id,
        }
    }

    pub(crate) fn vec_to_vector<T: BorshSerialize>(v: Vec<T>, prefix: &[u8]) -> Vector<T> {
        let mut vector = Vector::new(prefix);
        for i in v.iter() {
            vector.push(i);
        }
        vector
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use crate::{Node, SerializedSplitter, SplitterTrait};

    use super::*;
    use near_sdk::env::predecessor_account_id;
    use near_sdk::json_types::ValidAccountId;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;
    use near_sdk::MockedBlockchain;

    const INIT_ACCOUNT_BAL: u128 = 10_000;
    // mock the context for testing, notice "signer_account_id" that was accessed above from env::
    fn get_context(predecessor_account_id: ValidAccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id)
            .account_balance(INIT_ACCOUNT_BAL);
        builder
    }

    // TODO: should panic type
    #[test]
    #[should_panic]
    fn test_diff_numb_endpoints_and_splitter() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let contract = Contract::new();

        let splitter = SerializedSplitter {
            children: vec![SerializedNode::MallocCall {
                contract_id: "AA".to_string(),
                json_args: "{}".to_string(),
                gas: 128,
                attached_amount: 10.into(),
                next_spitters: vec![],
            }],
            splits: vec![100, 20],
            ft_contract_id: accounts(0).to_string(),
        };
        contract.deserialize(splitter, true);
    }

    #[test]
    #[should_panic]
    fn test_no_endpoints() {
        let contract = Contract::new();

        let splitter = SerializedSplitter {
            children: vec![],
            splits: vec![],
            ft_contract_id: accounts(0).to_string(),
        };
        contract.deserialize(splitter, true);
    }

    #[test]
    fn test_deserialize() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let contract = Contract::new();

        let splitter = SerializedSplitter {
            children: vec![
                SerializedNode::MallocCall {
                    contract_id: "AA".to_string(),
                    json_args: "{}".to_string(),
                    gas: 128,
                    attached_amount: 10.into(),
                    next_spitters: vec![],
                },
                SerializedNode::MallocCall {
                    contract_id: "AA".to_string(),
                    json_args: "{}".to_string(),
                    gas: 128,
                    attached_amount: 10.into(),
                    next_spitters: vec![],
                },
            ],
            splits: vec![20, 100],
            ft_contract_id: accounts(4).to_string(),
        };
        let deserial = contract.deserialize(splitter, true);
        assert_eq!(deserial.owner.to_string(), accounts(0).to_string());
        assert_eq!(deserial.ft_contract_id, accounts(4).to_string());
        assert_eq!(deserial.split_sum, 120);
        assert_eq!(deserial.children.len(), 2);
        assert_eq!(deserial.splits.len(), 2);
        assert_eq!(deserial.splits.to_vec(), vec![20, 100]);
    }
}
