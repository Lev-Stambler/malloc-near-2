import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import {
  compileConstruction,
  Construction,
  FtTransferCallToMallocCallAction,
  MallocCallAction,
  runEphemeralConstruction,
} from "../lib/malloc-ops";
import { BindParameter } from "../lib/parameter";

const BLACKWHOLE = TestingUtils.getMallocCallBlackwholeContract();
const PASSTHROUGH = TestingUtils.getMallocCallPassthroughContract();

describe("using the basic Action, Group, Construction, and Compile ops to create a construction", () => {
  it("Should create a two level construction with a ft transfer and then 2 blackwholes", async () => {
    const coolBlackWhole = MallocCallAction({
      mallocCallContractID: BLACKWHOLE,
      parameterNames: [["myCoolBlackWholeMessage", "message"]],
    });
    const coolPassThrough = MallocCallAction({
      mallocCallContractID: PASSTHROUGH,
      parameterNames: [["myCoolPassThroughToken", "tokenIn"]],
    });
    const ftTransfer = FtTransferCallToMallocCallAction({
      mallocCallContractID: "wrap.testnet",
    });
    const constructionPassThroughSimp = Construction({
      in: coolPassThrough({
        myCoolPassThroughToken: BindParameter("tokenUsed"),
      }),
      out: {
        "wrap.testnet": [
          {
            element: ftTransfer(),
            fraction: 9,
          },
          {
            element: coolBlackWhole({
              myCoolBlackWholeMessage: "lev is the mans",
            }),
            fraction: 1,
          },
        ],
      },
      parameterNames: ["tokenUsed"],
    });

    const construction = Construction({
      in: ftTransfer(),
      out: {
        "wrap.testnet": [
          {
            element: constructionPassThroughSimp({ tokenUsed: "wrap.testnet" }),
            fraction: 1,
          },
          {
            element: coolBlackWhole({
              myCoolBlackWholeMessage: "Nishad is the mans",
            }),
            fraction: "fractionBlackwhole",
          },
        ],
      },
    });

    const instr = await compileConstruction({
      startingConstructionOrActions: [
        { element: construction({ fractionBlackwhole: 10 }), fraction: 1 },
      ],
    });
    await runEphemeralConstruction(instr, "10000");
  });
});
