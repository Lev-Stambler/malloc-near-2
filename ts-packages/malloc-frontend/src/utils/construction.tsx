import {
  AccountId,
  Construction,
  MallocClient,
  SpecialAccount,
  MallocCallMetadata,
  Node,
} from "../../../malloc-client/lib/malloc-client";
import { Account } from "near-api-js";
import {
  Elements,
  BackgroundVariant,
  FlowElement,
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
  Connection,
  OnLoadParams,
  XYPosition,
} from "react-flow-renderer";
import { NodeLabel } from "../components/NodeLabel";
import { MallocFrontendErrors } from "./errors";
interface EndpointDisplayInfo {
  label: JSX.Element;
}

const makeid = (length: number) => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const getMallocCallMetadata = async (
  mallocCallId: AccountId,
  account: SpecialAccount
): Promise<MallocCallMetadata> => {
  return await account.viewFunction(mallocCallId, "metadata", {});
};

const getNodeDisplayInfo = async (
  node: Node,
  account: SpecialAccount
): Promise<EndpointDisplayInfo> => {
  if (node.FtTransferCallToMallocCall) {
    return { label: <NodeLabel name="Fungible Token Call" /> };
  } else if (node.MallocCall) {
    const metadata = await getMallocCallMetadata(
      node.MallocCall.malloc_call_id,
      account
    );
    return {
      label: (
        <NodeLabel
          name={metadata.name}
          contractId={node.MallocCall.malloc_call_id}
        />
      ),
    };
  }
  throw MallocFrontendErrors.MalformedEndpoint(node);
};

// /**
//  * @returns The flow node and the id
//  */
// export const nodeToElem = async (
//   node: Node,
//   account: SpecialAccount,
//   position: XYPosition
// ): Promise<[ReactFlowNode<any>, string]> => {
//   const elemId = makeid(10);
//   const displayInfo = await getNodeDisplayInfo(node, account);
//   const elem: ReactFlowNode = {
//     id: elemId,
//     data: { label: displayInfo.label },
//     className: "light",
//     position: position,
//   };

//   return [elem, elemId];
// };
