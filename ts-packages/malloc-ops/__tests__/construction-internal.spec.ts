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
    initialIndices: i.initialIndices,
  };
};

describe("Test instruction internal", () => {
  it("Should successfully unroll an action with not outputs", () => {
    const expected = {
      actions: [ACTION_FT_TRANSFER],
      nextActionsIndices: [[]],
      nextActionsSplits: [[]],
      initialIndices: [0],
    };
    const internalConst1 = _InternalConstruction.fromConstructionInOut(
      ACTION_FT_TRANSFER,
      null
    );

    const internalConst2 = _InternalConstruction.fromConstructionInOut(
      ACTION_FT_TRANSFER,
      []
    );

    expect(expected).toEqual(internalConstructionToObj(internalConst1));
    expect(expected).toEqual(internalConstructionToObj(internalConst2));
  });

  it("Should successfully unroll in action and outputs into internal construction for a height 2 construction", () => {
    const expected1 = {
      actions: [ACTION_FT_TRANSFER, ACTION_FT_TRANSFER, ACTION_FT_TRANSFER],
      nextActionsIndices: [[], [], [[0, 1]]],
      nextActionsSplits: [[], [], [[1, 1]]],
      initialIndices: [2],
    };

    const c1 = _InternalConstruction.fromConstructionInOut(ACTION_FT_TRANSFER, [
      {
        token_id: "wrap.testnet",
        next: [
          { element: ACTION_FT_TRANSFER, fraction: 1 },
          { element: ACTION_FT_TRANSFER, fraction: 1 },
        ],
      },
    ]);
    expect(expected1).toEqual(internalConstructionToObj(c1));
  });

  it("Should successfully unroll in action and outputs into internal construction for a construction made up of height 2 constructions", () => {
    const expectedWrappedWrapped = {
      actions: [
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
      ],
      nextActionsSplits: [
        [],
        [],
        [[1, 1]],
        [],
        [],
        [[1, 1]],
        [],
        [],
        [[1, 1]],
        [],
        [],
        [[1, 1]],
        [
          [1, 1],
          [1, 1],
        ],
      ],
      nextActionsIndices: [
        [],
        [],
        [[0, 1]],
        [],
        [],
        [[3, 4]],
        [],
        [],
        [[6, 7]],
        [],
        [],
        [[9, 10]],
        [
          [2, 5],
          [4, 7],
        ],
      ],
      initialIndices: [12],
    };

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
      nextActionsIndices: [[], [], [[0, 1]], [], [], [[3, 4]], [[2, 5]]],
      nextActionsSplits: [[], [], [[1, 1]], [], [], [[1, 1]], [[1, 1]]],
      initialIndices: [6],
    };

    const c1 = _InternalConstruction.fromConstructionInOut(ACTION_FT_TRANSFER, [
      {
        token_id: "wrap.testnet",
        next: [
          { element: ACTION_FT_TRANSFER, fraction: 1 },
          { element: ACTION_FT_TRANSFER, fraction: 1 },
        ],
      },
    ]);

    const cWrapped = _InternalConstruction.fromConstructionInOut(
      ACTION_FT_TRANSFER,
      [
        {
          token_id: "wrap.testnet",
          next: [
            { element: c1, fraction: 1 },
            { element: c1, fraction: 1 },
          ],
        },
      ]
    );

    const cWrappedWrapped = _InternalConstruction.fromConstructionInOut(
      ACTION_FT_TRANSFER,
      [
        {
          token_id: "wrap.testnet",
          next: [
            { element: c1, fraction: 1 },
            { element: c1, fraction: 1 },
          ],
        },
        {
          token_id: "wrap2.testnet",
          next: [
            { element: c1, fraction: 1 },
            { element: c1, fraction: 1 },
          ],
        },
      ]
    );
    expect(expectedWrapped).toEqual(internalConstructionToObj(cWrapped));
    expect(expectedWrappedWrapped).toEqual(
      internalConstructionToObj(cWrappedWrapped)
    );
  });

  it("Should merge internal constructions and have a list of elements more than 1 of initial indices", () => {
    const expected1 = {
      actions: [
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
        ACTION_FT_TRANSFER,
      ],
      nextActionsIndices: [
        [],
        [],
        [[0, 1]],
        [],
        [],
        [[3, 4]],
        [],
        [],
        [[6, 7]],
      ],
      nextActionsSplits: [[], [], [[1, 1]], [], [], [[1, 1]], [], [], [[1, 1]]],
      initialIndices: [2, 5, 8],
    };

    const c1 = _InternalConstruction.fromConstructionInOut(ACTION_FT_TRANSFER, [
      {
        token_id: "wrap.testnet",
        next: [
          { element: ACTION_FT_TRANSFER, fraction: 1 },
          { element: ACTION_FT_TRANSFER, fraction: 1 },
        ],
      },
    ]);
    const merged = _InternalConstruction.mergeMulti([c1, c1, c1]);
    expect(expected1).toEqual(internalConstructionToObj(merged));
  });

  it("Should work to create a two level construction without specifying next tokens", () => {
    const internalConst3 = _InternalConstruction.fromConstructionInOut(
      ACTION_FT_TRANSFER,
      [
        {
          next: [
            {
              element: ACTION_FT_TRANSFER,
              fraction: 1,
            },
          ],
        },
      ]
    );
    const expected = {
      actions: [
        {
          FtTransferCallToMallocCall: {
            malloc_call_id: "fake.testnet",
            token_id: "wrap.testnet",
          },
        },
        {
          FtTransferCallToMallocCall: {
            malloc_call_id: "fake.testnet",
            token_id: "wrap.testnet",
          },
        },
      ],
      nextActionsIndices: [[], [[0]]],
      nextActionsSplits: [[], [[1]]],
      initialIndices: [1],
    };
    expect(internalConstructionToObj(internalConst3)).toEqual(expected);
  });

  it("Should throw if the output token has an empty array", () => {
    try {
      const internalConst3 = _InternalConstruction.fromConstructionInOut(
        ACTION_FT_TRANSFER,
        [{ token_id: "wrap.testnet", next: [] }]
      );
      expect(false).toBe(true);
    } catch (e) {
      expect(e.toString()).toBe(
        "Expected the outputs to have at least 1 following action or construction"
      );
    }
  });
});
