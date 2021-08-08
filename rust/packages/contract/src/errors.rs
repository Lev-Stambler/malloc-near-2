pub mod Errors {
    pub const CONSTRUCTION_CALL_SPLITTER_CALL_NOT_FOUND: &str = "The splitter call for the given splitter call id was not found within the construction call";
    pub const CONSTRUCTION_CALL_SPLITTER_STACK_EMPTY: &str =
        "The splitter stack for the construction call is empty";
    pub const CONSTRUCTION_CALL_ID_NOT_FOUND: &str = "Construction Call ID does not exist";
    pub const NUMBER_OF_SPLITTERS_DID_NOT_MATCH_RETURN: &str =
        "The number of splitters for the next set of inputs does not match the call's return";
    pub const FAILED_TO_PARSE_NUMBER: &str = "Failed to parse a number from the string";
    pub const FT_CONTRACT_ID_NOT_MATCH: &str = "The returned fungible token contract type and the required fungible token type do not match";
    pub const FAILED_TO_PARSE_SPLITTER: &str = "Failed to parse the splitter string";
    pub const NO_CHILDREN_SPECIFIED: &str = "At least one child must be specified";
    pub const MORE_USED_THAN_ALLOWED: &str = "More currency was used than specified by the call";
    pub const NUMB_ENDPOINTS_DNE_NUMB_SPLITS: &str =
        "The number of endpoints specified does not match the number of splits";
    pub const CALLEE_DID_NOT_DEPOSIT_SUFFICIENT_FUNDS: &str =
        "The callee did not deposit sufficient funds";
}
