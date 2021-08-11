use crate::{errors::Errors, Contract, Node, Splitter};

impl Contract {
    pub(crate) fn check_splitter(&self, splitter: &Splitter) {
        if splitter.splits.0.len() != splitter.children.0.len() {
            panic!(Errors::NUMB_NODES_DNE_NUMB_SPLITS);
        }
        if splitter.splits.0.len() == 0 {
            panic!(Errors::NO_CHILDREN_SPECIFIED)
        }
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {

    use crate::test_utils::tests::{get_context, vec_to_vector};
    use crate::SplitterTrait;

    use super::*;
    use near_sdk::env::predecessor_account_id;
    use near_sdk::json_types::ValidAccountId;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;
    use near_sdk::MockedBlockchain;

    // TODO: should panic type
    #[test]
    #[should_panic]
    fn test_diff_numb_endpoints_and_splitter() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        let contract = Contract::new();

        let splitter = Splitter {
            children: vec_to_vector(
                vec![Node::MallocCall {
                    contract_id: "AA".to_string(),
                    json_args: "{}".to_string(),
                    gas: 128,
                    attached_amount: 10.into(),
                }]
                .as_slice(),
                "".as_bytes(),
            ),
            splits: vec_to_vector(vec![100, 20].as_slice(), "".as_bytes()),
            ft_contract_id: accounts(0).to_string(),
        };
        contract.check_splitter(&splitter);
    }

    #[test]
    #[should_panic]
    fn test_no_endpoints() {
        let contract = Contract::new();

        let splitter = Splitter {
            children: vec_to_vector(vec![].as_slice(), "".as_bytes()),
            splits: vec_to_vector(vec![].as_slice(), "".as_bytes()),
            ft_contract_id: accounts(0).to_string(),
        };
        contract.check_splitter(&splitter);
    }

    #[test]
    fn test_check() {
        // let context = get_context(accounts(0));
        // testing_env!(context.build());

        // let contract = Contract::new();

        // let splitter = SerializedSplitter {
        //     children: vec![
        //         SerializedNode::MallocCall {
        //             contract_id: "AA".to_string(),
        //             json_args: "{}".to_string(),
        //             gas: 128,
        //             attached_amount: 10.into(),
        //             // next_splitters: vec![],
        //         },
        //         SerializedNode::MallocCall {
        //             contract_id: "AA".to_string(),
        //             json_args: "{}".to_string(),
        //             gas: 128,
        //             attached_amount: 10.into(),
        //             // next_splitters: vec![],
        //         },
        //     ],
        //     splits: vec![20, 100],
        //     ft_contract_id: accounts(4).to_string(),
        // };
    }
}
