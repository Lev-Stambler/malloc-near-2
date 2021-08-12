use core::panic;
use std::string;

use near_sdk::{
    bs58::alphabet::Error,
    env, log,
    serde_json::{self, json},
    AccountId, Promise,
};

use crate::{
    errors::Errors, handle_not_found, node::NodeCallId, serde_ext::VectorWrapper, splitter,
    Construction, ConstructionCall, ConstructionCallId, ConstructionId, ConstructionNextSplitters,
    Contract, Node, NodeCallStatus, Splitter, SplitterCall, SplitterCallId, SplitterId, BASIC_GAS,
    CALLBACK_GAS,
};
