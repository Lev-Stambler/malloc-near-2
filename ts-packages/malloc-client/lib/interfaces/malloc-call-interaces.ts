import BN from "bn.js";

export interface MallocCallMetadata {
  minimum_gas?: BN;
  minimum_attached_deposit?: BN;
  name: string;
}