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
    /////////////////////////////////////////////////////
    const coolBlackWhole = MallocCallAction({
      mallocCallContractID: BLACKWHOLE,
    });
    const coolPassThrough = MallocCallAction({
      mallocCallContractID: PASSTHROUGH,
    });
    const ftTransfer = FtTransferCallToMallocCallAction({
      mallocCallContractID: "wrap.testnet",
    });
    const constructionPassThroughSimp = Construction({
      in: coolPassThrough({
        myCoolPassThroughToken: BindParameter("tokenIn"),
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
    });

    const construction = Construction({
      in: ftTransfer({tokenIn: "wrap.testnet"}),
      out: {
        "wrap.testnet": [
          {
            element: constructionPassThroughSimp({ tokenIn: "wrap.testnet" }),
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
    console.log(JSON.stringify(construction({fractionBlackwhole: 10})()))
    //////////////////////////////////////////////////

    // const instr = await compileConstruction({
    //   startingConstructionOrActions: [
    //     { element: construction({ fractionBlackwhole: 10 }), fraction: 1 },
    //   ],
    // });
    // await runEphemeralConstruction(instr, "10000");
  });

});

// TODO: finish up instr and running
// Then think of some way that makes sense to have malloc calls have some sort of typing
// Rn everything is untyped an ugly, static typing for the GenericParameters would be so,
// damn, nice... (it could be having GenericType take in a T and then having the function builder take in a generic type
