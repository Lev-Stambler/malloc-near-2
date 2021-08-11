pub type MallocError = String;

pub mod Errors {
    // Malloc Call Errors
    pub const MALLOC_CALL_FAILED: &str = "The malloc call failed";

    // Not found errors
    pub const CONSTRUCTION_CALL_SPLITTER_CALL_NOT_FOUND: &str = "The splitter call for the given splitter call id was not found within the construction call";
    pub const CONSTRUCTION_CALL_ID_NOT_FOUND: &str = "Construction Call ID does not exist";
    pub const SPLITTER_OWNER_NOT_FOUND: &str = "Splitter owner not found";
    pub const CONSTRUCTION_CALL_NOT_FOUND: &str = "The construction call was not found";
    pub const CONSTRUCTION_NOT_FOUND: &str =
        "The construction with the given id not found in the owner's construction collection";
    pub const SPLITTER_NOT_FOUND: &str =
        "The Splitter with the given id not found in the owner's splitter collection";
    pub const CONSTRUCTION_OWNER_NOT_FOUND: &str = "Construction owner not found";
    pub const SPLITTER_NOT_FOUND_IN_CONSTRUCTION: &str =
        "The supplied splitter index is not found in the construction's splitter list";
    pub const NEXT_SPLITTER_SET_NOT_FOUND_PER_SPLITTER: &str = "The next splitter set for a splitter was not found for the construction with the given index";
    pub const NEXT_SPLITTER_SET_NOT_FOUND_PER_CHILD: &str =
        "The next splitter set for a child of a splitter was not found for the construction";

    // Unauthorized errors
    pub const CALLER_DOES_NOT_OWN_CONSTRUCTION: &str = "The caller does not own the construction";

    // Parsing Errors
    pub const FAILED_TO_PARSE_NUMBER: &str = "Failed to parse a number from the string";
    pub const FAILED_TO_PARSE_SPLITTER: &str = "Failed to parse the splitter string";

    // Funding Errors
    pub const CALLEE_DID_NOT_DEPOSIT_SUFFICIENT_FUNDS: &str =
        "The callee did not deposit sufficient funds";

    // ID Registration errors
    pub const CONSTRUCTION_CALL_ID_ALREADY_USED: &str =
        "The given construction call id has already been registered";
    pub const NODE_CALL_ID_ALREADY_USED: &str =
        "The given node call id has already been registered";

    // Malformed Errors: Errors corresponding to splitters and constructions with incorrect shapes and/or inputs
    pub const NUMB_OF_NODES_NOT_EQUAL_TO_NUMB_NAMES: &str = "The number of nodes does not equal to the number of names";
    pub const CONSTRUCTION_CALL_SPLITTER_STACK_EMPTY: &str =
        "The splitter stack for the construction call is empty";
    pub const NUMBER_OF_SPLITTERS_DID_NOT_MATCH_RETURN: &str =
        "The number of splitters for the next set of inputs does not match the call's return";
    pub const FT_CONTRACT_ID_NOT_MATCH: &str = "The returned fungible token contract type and the required fungible token type do not match";
    pub const NO_CHILDREN_SPECIFIED: &str = "At least one child must be specified";
    pub const MORE_USED_THAN_ALLOWED: &str = "More currency was used than specified by the call";
    pub const NUMB_NODES_DNE_NUMB_SPLITS: &str =
        "The number of endpoints specified does not match the number of splits";
    pub const NUMB_OF_SPLITTER_IDXS_DID_NOT_MATCH_SPLITTERS: &str =
        "The number of splitter indixes does not match the number of splitters";
}
