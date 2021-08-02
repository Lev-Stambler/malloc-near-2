interface NodeLabelProps {
  name: string;
  contractId?: string;
}

export function NodeLabel(props: NodeLabelProps) {
  return (
    <div>
      {props.name} {props.contractId && <>": " {props.contractId}</>}
    </div>
  );
}
