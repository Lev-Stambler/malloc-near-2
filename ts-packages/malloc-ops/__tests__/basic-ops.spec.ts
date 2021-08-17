import * as TestingUtils from "../../testing-utils/lib/testing-utils";
import { MallocCallNode } from "../lib/malloc-ops";

const createBlackWholeNode = (tokenIn: string) => {
  const id = TestingUtils.getMallocCallBlackwholeContract();
  MallocCallNode({
		mallocCallContractID: id,
		tokenIn,
		parameters: ["message"],	
	});
};

describe("using the basic Node, Group, Construction, and Compile ops to create a construction", () => {
  it("Should create a two level construction with a ft transfer and then 2 blackwholes", async () => {});
});
