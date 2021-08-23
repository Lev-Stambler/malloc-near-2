import {
  ActionOutputsForConstruction,
  GenericParameters,
} from "../lib/interfaces";
import { MallocCallAction } from "../lib/malloc-ops";
import { _InternalConstruction } from "../lib/internal/construction-internal";
import {
  fillFractionSplitsAndToken,
  resolveParameters,
} from "../lib/internal/parameter-replacement-internal";
import { BindParameter } from "../lib/parameter";

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
  it("Should resolve the binded parameters in a child", () => {
    const params: GenericParameters = {
      tokenIn: "X",
      other: "Y",
      final: BindParameter("AA"),
    };
    const parentParameters: GenericParameters = {
      AA: "COOL BOY",
    };
    const resolved = resolveParameters(params, parentParameters);
    expect(resolved).toEqual({
      AA: "COOL BOY",
      tokenIn: "X",
      other: "Y",
      final: "COOL BOY",
    });
  });

  it("Should resolve a binded parameter in a grandchild", () => {
    const params: GenericParameters = {
      tokenIn: "X",
      other: "Y",
      final: BindParameter("AA"),
    };
    const parentParameters: GenericParameters = {
      XX: "COOL BOY",
    };
    const grandParentParameters: GenericParameters = {
      AA: "COOL BOY: electric boogala",
    };
    const resolved = resolveParameters(
      params,
      resolveParameters(parentParameters, grandParentParameters)
    );
    expect(resolved).toEqual({
      AA: "COOL BOY: electric boogala",
      XX: "COOL BOY",
      tokenIn: "X",
      other: "Y",
      final: "COOL BOY: electric boogala",
    });
  });

  it("Should fail because a binded parameter was not found in the parent", () => {
    try {
      resolveParameters({ a: BindParameter("A") }, {});
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error).toEqual(
        `Expected the parameter a to have parameter A in its parent's parameters`
      );
    }
  });
});

describe("Test fill fraction and splits", () => {
  it("Should fill a token out which is a binded value", () => {
    const out: ActionOutputsForConstruction = [
      {
        token_id: BindParameter("G"),
        next: [],
      },
    ];
    const filled = fillFractionSplitsAndToken(out, { G: "tok.testnet" });
    expect(filled).toEqual([{ next: [], token_id: "tok.testnet" }]);
  });

  it("Should fill a parameter in the next item", () => {
    {
      const out: ActionOutputsForConstruction = [
        {
          token_id: "token",
          next: [
            {
              element: MallocCallAction({
                mallocCallContractID: "fake",
                callArgNames: ["lev"],
                prefilledParameters: { tokenIn: "l" },
              })(),
              fraction: "1",
            },
          ],
        },
      ];
      const filled = fillFractionSplitsAndToken(out, { lev: "is fun" });
      expect(filled).toEqual([
        {
          token_id: "token",
          next: [
            {
              element: MallocCallAction({
                mallocCallContractID: "fake",
                prefilledParameters: { tokenIn: "l" },
                callArgNames: ["lev"],
              })()({ lev: "is fun" }),
              fraction: "1",
            },
          ],
        },
      ]);
    }
  });

  it("Should fill a fraction which is a binded value", () => {
    {
      const out: ActionOutputsForConstruction = [
        {
          token_id: "token",
          next: [
            {
              element: () => ACTION_FT_TRANSFER,
              fraction: BindParameter("A"),
            },
          ],
        },
      ];
      const filled = fillFractionSplitsAndToken(out, { A: "1" });
      expect(filled).toEqual([
        {
          token_id: "token",
          next: [
            {
              element: ACTION_FT_TRANSFER,
              fraction: "1",
            },
          ],
        },
      ]);
    }
  });
});
