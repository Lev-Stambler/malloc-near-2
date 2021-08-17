import BN from "bn.js";
import {
  SpecialAccount,
  Node,
  MallocCallMetadata,
  AccountId,
  NodeTypes,
} from "./interfaces";

/**
 * @param  {SpecialAccount} callerAccount
 * @param  {Node} node
 * @returns Promise
 */
export const getNodeAttachedDepositForNode = async (
  callerAccount: SpecialAccount,
  node: Node<NodeTypes>
): Promise<BN> => {
  if (node.MallocCall) {
    const metadata = await getMallocCallMetadata(
      callerAccount,
      node.MallocCall.malloc_call_id
    );
    return new BN(metadata.minimum_attached_deposit || 1);
  } else if (node.FtTransferCallToMallocCall) {
    return new BN(1);
  }
  return new BN(0);
};

export const getMallocCallMetadata = async (
  callerAccount: SpecialAccount,
  malloc_call_id: AccountId
): Promise<MallocCallMetadata> => {
  const metadata: MallocCallMetadata = await callerAccount.viewFunction(
    malloc_call_id,
    "metadata"
  );
  return metadata;
};
