import type { Contract, WalletConnection } from "near-api-js";

type BigNumberish = number | string;
type AccountId = string;

// Enum endpoint
interface Endpoint {
  SimpleTransfer?: { recipient: AccountId };
  FTTransfer?: { recipient: AccountId };
}

interface SerializedSplitter {
  nodes: Endpoint[];
  splits: BigNumberish[];
  owner: AccountId;
  split_sum: BigNumberish;
  ft_contract_id?: AccountId;
}

export interface MallocContract extends Contract {
  run_ephemeral: (
    args: { splitter: SerializedSplitter },
    gas?: BigNumberish,
    attachedDeposit?: BigNumberish
  ) => Promise<any>;
}
declare global {
  interface Window {
    contract: MallocContract;
    walletConnection: WalletConnection;
    accountId: AccountId;
    nearInitPromise: Promise<void>;
  }
}
