import { Handle, Position } from "react-flow-renderer";
import { MallocCall } from "../../../../malloc-client/lib/malloc-client";

interface MallocCallElemData {
  mallocCall: MallocCall;
  name: string;
}

const MallocCallElem = ({ data }: { data: MallocCallElemData }) => {
  return (
    <div className="node malloc-call">
      <Handle
        type="target"
        position={Position.Left}
        style={{ borderRadius: 0 }}
      />
      <div>Malloc Call: {data.name}</div>
      <Handle
        type="source"
        position={Position.Right}
        id="a"
        style={{ top: "30%", borderRadius: 0 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="b"
        style={{ top: "70%", borderRadius: 0 }}
      />
    </div>
  );
};

export default MallocCallElem;
