import { _InternalConstruction } from "../lib/construction-internal";

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

describe("Test instruction internal", () => {
  it("Should successfully unroll an action with not outputs", () => {
    const expected = {
      actions: [ACTION_FT_TRANSFER],
      nextActionsIndices: [[[]]],
      nextActionsSplits: [[[]]],
    };
    const internalConst1 = _InternalConstruction.fromConstructionInOut(
      ACTION_FT_TRANSFER,
      null
    );

    const internalConst2 = _InternalConstruction.fromConstructionInOut(
      ACTION_FT_TRANSFER,
      {}
    );

    expect(expected).toEqual(internalConstructionToObj(internalConst1));
    expect(expected).toEqual(internalConstructionToObj(internalConst2));
  });

  it("Should successfully unroll in action and outputs into internal construction for a height 2 construction", () => {
    const expected1 = {
      actions: [ACTION_FT_TRANSFER, ACTION_FT_TRANSFER, ACTION_FT_TRANSFER],
      nextActionsIndices: [[[]], [[]], [[0, 1]]],
      nextActionsSplits: [[[]], [[]], [[1, 1]]],
    };

    const c1 = _InternalConstruction.fromConstructionInOut(ACTION_FT_TRANSFER, {
      "wrap.testnet": [
        { element: ACTION_FT_TRANSFER, fraction: 1 },
        { element: ACTION_FT_TRANSFER, fraction: 1 },
      ],
    });
    expect(expected1).toEqual(internalConstructionToObj(c1));
  });

  it("Should successfully unroll in action and outputs into internal construction for a construction made up of height 2 constructions", () => {
    const expectedWrapped = {
      actions: [
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
      ],
      nextActionsIndices: [[[]], [[]], [[0, 1]]],
      nextActionsSplits: [[[]], [[]], [[1, 1]]],
    };

    const c1 = _InternalConstruction.fromConstructionInOut(ACTION_FT_TRANSFER, {
      "wrap.testnet": [
        { element: ACTION_FT_TRANSFER, fraction: 1 },
        { element: ACTION_FT_TRANSFER, fraction: 1 },
      ],
    });

    const cWrapped = _InternalConstruction.fromConstructionInOut(
      ACTION_FT_TRANSFER,
      {
        "wrap.testnet": [
          { element: c1, fraction: 1 },
          { element: c1, fraction: 1 },
        ],
      }
    );
		console.log(JSON.stringify(cWrapped, null, 3))
    expect(expectedWrapped).toEqual(internalConstructionToObj(cWrapped));
  });

  it("Should throw if the output token has an empty array", () => {
    try {
      const internalConst3 = _InternalConstruction.fromConstructionInOut(
        ACTION_FT_TRANSFER,
        { "wrap.testnet": [] }
      );
      expect(false).toBe(true);
    } catch (e) {
      expect(e.toString()).toBe(
        "Expected the outputs to have at least 1 following action or construction"
      );
    }
  });
});
