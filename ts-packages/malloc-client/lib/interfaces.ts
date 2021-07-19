import BN from "bn.js";
import type {
  Account,
  ConnectedWalletAccount,
  Contract,
  KeyPair,
  WalletConnection,
} from "near-api-js";

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

export interface RunEphemeralOpts {
  checkSuccessful: boolean;
}

export interface RegisterAccountWithFungibleTokenOpts {}

export type CallEphemeralFn = (
  splitter: Splitter,
  opts?: RunEphemeralOpts
) => Promise<void>;

/**
 * @param  {AccountId[]} tokens A list of the token contract account ids
 * @param  {AccountId} registerFor The account to register for all the token contracts
 * @param  {RegisterAccountWithFungibleTokenOpts} opts?
 * @returns A list of token account ids which were newly registered
 */
export type RegisterAccountWithFungibleTokenFn = (
  tokens: AccountId[],
  registerFor: AccountId,
  opts?: RegisterAccountWithFungibleTokenOpts
) => Promise<AccountId[]>;

export interface MallocClient {
  runEphemeralSplitter: CallEphemeralFn;
  registerAccountWithFungibleToken: RegisterAccountWithFungibleTokenFn;
}

export enum SpecialAccountType {
  KeyPair = "KEY_PAIR",
  WebConnected = "WEB_CONNECTED",
}

interface SpecialAccountBase {
  type: SpecialAccountType;
}

export interface SpecialAccountWithKeyPair extends SpecialAccountBase, Account {
  type: SpecialAccountType.KeyPair;
  keypair: KeyPair;
}

export interface SpecialAccountConnectedWallet
  extends SpecialAccountBase,
    ConnectedWalletAccount {
  type: SpecialAccountType.WebConnected;
}
