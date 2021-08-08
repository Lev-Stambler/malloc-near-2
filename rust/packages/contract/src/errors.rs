pub enum Errors {
    NoChildrenSpecified,
    MoreUsedThanAllowed,
    NumbEndpointsDneNumbSplits,
    CalleeDidNotDepositSufficientFunds,
    FailedToParseSplitter,
    FTContractIdNotMatch,
    NumberOfSplittersDidNotMatchReturn,
    FailedToParseNumber,
}

impl ToString for Errors {
    fn to_string(&self) -> String {
        match self {
            Self::NumberOfSplittersDidNotMatchReturn => "The number of splitters for the next set of inputs does not match the call's return".to_string(),
            Self::FailedToParseNumber => "Failed to parse a number from the string".to_string(),
            Self::FTContractIdNotMatch => "The returned fungible token contract type and the required fungible token type do not match".to_string(),
            Self::FailedToParseSplitter => "Failed to parse the splitter string".to_string(),
            Self::NoChildrenSpecified => "At least one child must be specified".to_string(),
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
