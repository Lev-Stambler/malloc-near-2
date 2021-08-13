import Snackbar from "@material-ui/core/Snackbar";
import BN from "bn.js";
import React, { useState, MouseEvent, useEffect } from "react";
import "./flowchart.css";
// export interface MallocCall {
//   check_callback?: boolean;
//   malloc_call_id: AccountId;
//   json_args: string;
//   gas: number;
//   attached_amount: string;
//   skip_ft_transfer?: boolean;
//   token_id: AccountId;
// }



import ReactFlow, {
  removeElements,
  addEdge,
  isNode,
  Background,
  Elements,
  BackgroundVariant,
  FlowElement,
  Node,
  Edge,
  Connection,
  OnLoadParams,
} from "react-flow-renderer";
import { Alert } from "../Alert";
import FlowMenu from "./Menu";
import MallocCallElem from "./MallocCallElem";
import { Construction } from "../../../../malloc-client/lib/malloc-client";

const onNodeDragStop = (_: MouseEvent, node: Node) =>
  console.log("drag stop", node);
const onElementClick = (_: MouseEvent, element: FlowElement) =>
  console.log("click", element);

interface FlowChartProps {
  constructionInit?: Construction;
}

const nodeTypes = {
  mallocCall: MallocCallElem,
};

const Flow = (props: FlowChartProps) => {
  const [rfInstance, setRfInstance] = useState<OnLoadParams | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elements, setElements] = useState<Elements>([]);
  const onElementsRemove = (elementsToRemove: Elements) =>
    setElements((els) => removeElements(elementsToRemove, els));
  const onConnect = (params: Edge | Connection) =>
    setElements((els) => addEdge(params, els));
  const onLoad = (reactFlowInstance: OnLoadParams) =>
    setRfInstance(reactFlowInstance);

  // TODO: del
  useEffect(() => {
    console.log("AAA");
    setElements([
      {
        id: "2",
        type: "mallocCall",
        position: { x: 100, y: 100 },
        data: {},
      },
    ]);
  }, []);

  const updatePos = () => {
    setElements((elms) => {
      return elms.map((el) => {
        if (isNode(el)) {
          el.position = {
            x: Math.random() * 400,
            y: Math.random() * 400,
          };
        }

        return el;
      });
    });
  };

  const logToObject = () => console.log(rfInstance?.toObject());
  const resetTransform = () =>
    rfInstance?.setTransform({ x: 0, y: 0, zoom: 1 });

  return (
    <>
      <div className="flow--wrapper" style={{ height: "50%" }}>
        <ReactFlow
          elements={elements}
          onLoad={onLoad}
          nodeTypes={nodeTypes}
          onElementClick={onElementClick}
          onElementsRemove={onElementsRemove}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          className="react-flow-basic-example"
          defaultZoom={1.5}
          minZoom={0.2}
          maxZoom={4}
        >
          <Background variant={BackgroundVariant.Lines} />
        </ReactFlow>
      </div>
      <FlowMenu />
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => {}}>
        <Alert onClose={() => {}} severity="error">
          <>{error}</>
        </Alert>
      </Snackbar>
    </>
  );
};

export default Flow;
