import { MallocClient } from "../../malloc-client/lib/malloc-client";
import { SpecialAccountWithKeyPair } from "../../malloc-client/lib/interfaces";
import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import {
  compile,
  Construction,
  FtTransferCallToMallocCallAction,
  MallocCallAction,
} from "../lib/malloc-ops";
import { BindParameter } from "../lib/parameter";

const BLACKWHOLE = TestingUtils.getMallocCallBlackwholeContract();
const PASSTHROUGH = TestingUtils.getMallocCallPassthroughContract();

let malloc: MallocClient<SpecialAccountWithKeyPair>;
const amountWNearPerTest = 100000;
const NUMB_TESTS = 1;
let depositTx: string;

describe("using the basic Action, Group, Construction, and Compile ops to create a construction", () => {
  jest.setTimeout(60 * 1000);

  beforeAll(async () => {
    const masterAccount = await TestingUtils.getDefaultTesterAccountNear();
    // const testerAccount = await TestingUtils.newRandAccount(masterAccount);
    const wrappedTesterAccount = masterAccount;
    malloc = new MallocClient(
      wrappedTesterAccount,
      TestingUtils.getMallocContract()
    );
    await malloc.registerAccountDeposits(
      [TestingUtils.WRAP_TESTNET_CONTRACT],
      [
        TestingUtils.getMallocContract(),
        wrappedTesterAccount.accountId,
        BLACKWHOLE,
        PASSTHROUGH,
      ]
    );
    await TestingUtils.setupWNearAccount(
      TestingUtils.WRAP_TESTNET_CONTRACT,
      wrappedTesterAccount.accountId,
      wrappedTesterAccount,
      true,
      amountWNearPerTest * NUMB_TESTS
    );
    depositTx = await malloc.deposit(
      (amountWNearPerTest * NUMB_TESTS).toString(),
      TestingUtils.WRAP_TESTNET_CONTRACT
    );
  });

  it("Should create a two level construction with a ft transfer and then 2 blackwholes", async () => {
    /////////////////////////////////////////////////////
    const coolBlackWhole = MallocCallAction({
      mallocCallContractID: BLACKWHOLE,
      callArgNames: ["log_message"],
    });
    const coolPassThrough = MallocCallAction({
      mallocCallContractID: PASSTHROUGH,
      prefilledParameters: {
        log_message: "HEEE",
      },
      callArgNames: ["log_message"],
    });
    const ftTransfer = FtTransferCallToMallocCallAction({
      mallocCallContractID: PASSTHROUGH,
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
              log_message: BindParameter("fromTheTop"),
            }),
            fraction: 1,
          },
        ],
      },
    });

    const construction = Construction({
      in: ftTransfer({ tokenIn: "wrap.testnet" }),
      out: {
        // TODO: ORDER IN HOW YOU DEFINE IT MATTERS HERE!!!!
        parameterTokenId: [
          {
            element: constructionPassThroughSimp({ tokenIn: "wrap.testnet" }),
            fraction: 1,
          },
          {
            element: coolBlackWhole({
              log_message: "Nishad is the mans",
            }),
            fraction: "fractionBlackwhole",
          },
        ],
      },
    });
    const toRun = construction({
      fractionBlackwhole: 10,
      fromTheTop: "Lev is the mans",
      parameterTokenId: "wrap.testnet",
    });
    //////////////////////////////////////////////////

    const inst = await compile({
      initialConstructionOrActions: [{ element: toRun, fraction: 1 }],
    });
    console.log(JSON.stringify(inst(amountWNearPerTest.toString())))
    const txs = await malloc.runEphemeralConstruction(
      inst(amountWNearPerTest.toString())
    );
    await malloc.resolveTransactions(txs);
  });
});

// TODO: finish up instr and running
// Then think of some way that makes sense to have malloc calls have some sort of typing
// Rn everything is untyped an ugly, static typing for the GenericParameters would be so,
// damn, nice... (it could be having GenericType take in a T and then having the function builder take in a generic
