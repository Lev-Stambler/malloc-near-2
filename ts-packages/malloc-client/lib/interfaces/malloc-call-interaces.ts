import BN from "bn.js";

export interface MallocCallMetadata {
  gas_required: number;
  attachment_required: BN | string;
  name: string;
}