import Snackbar from "@material-ui/core/Snackbar";
import BN from "bn.js";
import React, { useState, MouseEvent, useEffect } from "react";

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
import { Splitter } from "@malloc/sdk";
import { Alert } from "../components/Alert";
import { splitterToFlowChart } from "../utils/index";

const onNodeDragStop = (_: MouseEvent, node: Node) =>
  console.log("drag stop", node);
const onElementClick = (_: MouseEvent, element: FlowElement) =>
  console.log("click", element);

interface FlowChartProps {
  splitterInit: Splitter;
}

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

  useEffect(() => {
    splitterToFlowChart(props.splitterInit)
      .then(setElements)
      .catch((err) => setError(err.toString()));
  }, [props.splitterInit]);

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

  const toggleClassnames = () => {
    setElements((elms) => {
      return elms.map((el) => {
        if (isNode(el)) {
          el.className = el.className === "light" ? "dark" : "light";
        }

        return el;
      });
    });
  };

  return (
    <>
      <ReactFlow
        elements={elements}
        onLoad={onLoad}
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

        <div style={{ position: "absolute", right: 10, top: 10, zIndex: 4 }}>
          <button onClick={resetTransform} style={{ marginRight: 5 }}>
            reset transform
          </button>
          <button onClick={updatePos} style={{ marginRight: 5 }}>
            change pos
          </button>
          <button onClick={toggleClassnames} style={{ marginRight: 5 }}>
            toggle classnames
          </button>
          <button onClick={logToObject}>toObject</button>
        </div>
      </ReactFlow>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => {}}>
        <Alert onClose={() => {}} severity="error">
          <>{error}</>
        </Alert>
      </Snackbar>
    </>
  );
};

export default Flow;
