import type { Contract, WalletConnection } from "near-api-js";
import {
  SpecialAccountConnectedWallet,
  MallocClient,
} from "../../malloc-client/lib/malloc-client";

type BigNumberish = number | string;
type AccountId = string;

// Enum endpoint
interface Endpoint {
  SimpleTransfer?: { recipient: AccountId };
  FTTransfer?: { recipient: AccountId };
  WCall?: {
    contract_id: AccountId;
    json_args: string;
    gas: number;
    attached_amount: number;
  };
}

interface SerializedSplitter {
  actions: Endpoint[];
  splits: BigNumberish[];
  ft_contract_id?: AccountId;
}

export interface MallocContract extends Contract {
  run_ephemeral: (
    args: { splitter: SerializedSplitter; amount?: BigNumberish },
    gas?: BigNumberish,
    attachedDeposit?: BigNumberish
  ) => Promise<any>;
}
declare global {
  interface Window {
    contract: MallocContract;
    walletConnection: WalletConnection;
    account: SpecialAccountConnectedWallet;
    accountId: AccountId;
    mallocClient: MallocClient;
    nearInitPromise: Promise<void>;
  }
}
