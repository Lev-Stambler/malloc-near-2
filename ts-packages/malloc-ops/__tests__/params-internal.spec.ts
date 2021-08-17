import { _InternalConstruction } from "../lib/internal/construction-internal";

const ACTION_FT_TRANSFER = {
  FtTransferCallToMallocCall: {
    malloc_call_id: "fake.testnet",
    token_id: "wrap.testnet",
  },
};

const internalConstructionToObj = (i: _InternalConstruction) => {
  return {
    actions: i.actions,
    nextActionsIndices: i.nextActionsIndices,
    nextActionsSplits: i.nextActionsSplits,
  };
};

describe("Test internal parameter replacement", () => {
  xit("Should ...", () => {});

  xit("Should successfully unroll in action and outputs into internal construction for a height 2 construction", () => {});

  xit("Should successfully unroll in action and outputs into internal construction for a construction made up of height 2 constructions", () => {});

  xit("Should throw if the output token has an empty array", () => {});
});
