use near_sdk::env::panic;

pub enum Errors {
    NoEndpointsSpecified,
    MoreUsedThanAllowed,
    NumbEndpointsDneNumbSplits,
    CalleeDidNotDepositSufficientFunds,
    FailedToParseSplitter,
}

impl ToString for Errors {
    fn to_string(&self) -> String {
        match self {
            Self::FailedToParseSplitter => "Failed to parse the splitter string".to_string(),
            Self::NoEndpointsSpecified => "At least one endpoint must be specified".to_string(),
            Self::MoreUsedThanAllowed => {
                "More currency was used than specified by the call".to_string()
            }
            Self::NumbEndpointsDneNumbSplits => {
                "The number of endpoints specified does not match the number of splits".to_string()
            }
            Self::CalleeDidNotDepositSufficientFunds => {
                "The callee did not deposit sufficient funds".to_string()
            }
        }
    }
}

// TODO: make into macro
pub fn throw_err(err: Errors) {
    panic!("{}", err.to_string())
}
