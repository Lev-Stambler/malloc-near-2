import BN from "bn.js";
import type { Contract, WalletConnection } from "near-api-js";

export type BigNumberish = BN | number | string;
export type AccountId = string;

// Enum endpoint
export interface Endpoint {
  SimpleTransfer?: { recipient: AccountId };
  FTTransfer?: { recipient: AccountId };
  WCall?: {
    contract_id: AccountId;
    json_args: String;
    gas: number;
  };
}

export interface Splitter {
  nodes: Endpoint[];
  splits: BigNumberish[];
  owner: AccountId;
  split_sum: BigNumberish;
  ft_contract_id?: AccountId;
}

export interface MallocContract extends Contract {
  run_ephemeral: (
    args: { splitter: Splitter; amount?: BigNumberish },
    gas?: BigNumberish,
    attachedDeposit?: BigNumberish
  ) => Promise<any>;
}

export interface WCallEndpointMetadata {
  minimum_gas?: BN;
  minimum_attached_deposit?: BN;
}

export interface Transaction {
  receiverId: string;
  functionCalls: FunctionCallOptions[];
}

export interface ViewFunctionOpts {
  methodName: string;
  args?: object;
}

export interface FunctionCallOptions extends ViewFunctionOpts {
  gas?: string;
  amount?: string;
}
