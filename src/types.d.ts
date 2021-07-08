import type { Contract, WalletConnection } from "near-api-js";

type BigNumberish = number | string;
type AccountId = string;

// Enum endpoint
interface Endpoint {
  SimpleTransferLeaf?: { recipient: AccountId };
}

interface SerializedSplitter {
  nodes: Endpoint[];
  splits: BigNumberish[];
  owner: AccountId;
  split_sum: BigNumberish;
}

export interface MallocContract extends Contract {
  run_ephemeral: (args: { splitter: SerializedSplitter }) => Promise<void>;
}
declare global {
  interface Window {
    contract: MallocContract;
    walletConnection: WalletConnection;
    accountId: AccountId;
    nearInitPromise: Promise<void>;
  }
}
