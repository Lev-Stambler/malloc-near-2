import {
  AccountId,
  Endpoint,
  MallocClient,
  SpecialAccount,
  Splitter,
  WCallEndpointMetadata,
} from "@malloc/sdk";
import { Account } from "near-api-js";
import {
  Elements,
  BackgroundVariant,
  FlowElement,
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
  Connection,
  OnLoadParams,
} from "react-flow-renderer";
import { NodeLabel } from "../components/NodeLabel";
import { MallocFrontendErrors } from "./errors";

interface EndpointDisplayInfo {
  label: JSX.Element;
}

const getEndpointMetadata = async (
  wcallContract: string,
  account: SpecialAccount
): Promise<WCallEndpointMetadata> => {
  return await window.walletConnection
    .account()
    .viewFunction(wcallContract, "metadata", {});
};

const getEndpointDisplayInfo = async (
  node: Endpoint
): Promise<EndpointDisplayInfo> => {
  if (node.FTTransfer) {
    return { label: <NodeLabel name="Fungible token transfer" /> };
  } else if (node.SimpleTransfer) {
    return { label: <NodeLabel name="Native token transfer" /> };
  } else if (node.WCall) {
    const metadata = await getEndpointMetadata(
      node.WCall.contract_id,
      window.account
    );
    return {
      label: (
        <NodeLabel name={metadata.name} contractId={node.WCall.contract_id} />
      ),
    };
  }
  throw MallocFrontendErrors.MalformedEndpoint(node);
};

const nodeToElemAndConnection = async (
  node: Endpoint,
  i: number
): Promise<[ReactFlowNode<any>, ReactFlowEdge<any> | undefined]> => {
  const elemId = (i + 1).toString();
  const displayInfo = await getEndpointDisplayInfo(node);
  const elem: ReactFlowNode = {
    id: elemId,
    data: { label: displayInfo.label },
    className: "light",
    position: { x: 100 + 200 * i, y: 100 },
  };
  const connection: ReactFlowEdge = {
    id: `0-to-${elemId}`,
    source: "0",
    target: elemId,
    animated: true,
  };

  return [elem, connection];
};

// For a one level splitter
export const splitterToFlowChart = async (
  splitter: Splitter
): Promise<Elements> => {
  const elems: Elements = [
    {
      id: "0",
      type: "input",
      data: { label: "Input Node" },
      position: { x: 250, y: 5 },
      className: "light",
    },
  ];

  // Create an array of just the children
  const children = [...splitter.nodes];
  const elemsAndConnections = await Promise.all(
    // Add 1 to i because the first element is removed
    children.map((elem, i) => nodeToElemAndConnection(elem, i))
  );
  elemsAndConnections.forEach((elemAndConn) => {
    const [elem, conn] = elemAndConn;
    elems.push(elem);
    if (conn) elems.push(conn);
  });
  return elems;
  return [
    {
      id: "2",
      data: { label: "Node 2" },
      position: { x: 100, y: 100 },
      className: "light",
    },
    {
      id: "3",
      data: { label: "Node 3" },
      position: { x: 400, y: 100 },
      className: "light",
    },
    {
      id: "4",
      data: { label: "Node 4" },
      position: { x: 400, y: 200 },
      className: "light",
    },
    { id: "e1-2", source: "1", target: "2", animated: true },
    { id: "e1-3", source: "1", target: "3" },
  ];
};
