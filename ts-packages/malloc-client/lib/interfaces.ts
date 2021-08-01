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
    json_args: string;
    gas: number;
    attached_amount: string;
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
  gas: BigNumberish;
  depositTransactionHash: string;
}

export interface RegisterAccountWithFungibleTokenOpts {}

export type CallEphemeralFn<T extends string[] | void> = (
  splitter: Splitter,
  amount: string,
  opts?: Partial<RunEphemeralOpts>
) => Promise<T>;

/**
 * @param  {AccountId[]} tokens A list of the token contract account ids
 * @param  {AccountId[]} registerForAccounts The accounts to register for all the token contracts
 * @param  {RegisterAccountWithFungibleTokenOpts} opts?
 * @returns A list of token account ids which were newly registered
 */
export type RegisterAccountWithFungibleTokenFn = (
  tokens: AccountId[],
  registerForAccounts: AccountId[],
  opts?: RegisterAccountWithFungibleTokenOpts
) => Promise<AccountId[]>;

// TODO: what do we want this return to be?
export type ResolveTransactionsFn = (
  hashes: string[]
) => Promise<TransactionWithPromiseResult>;

export type DepositFn<T extends string | void> = (
  amount: string,
  tokenAccountId: string
) => Promise<T>;

/**
 * MallocClient is the for interacting with the set of Malloc Contracts via the Malloc SDK
 *
 * @param SpecialAccountTypeGeneric the type of special account. If the special account is a web connected wallet, then
 * deposit and runEphemeralSplitter do not return. If they are accounts derived from a key pair, then they return the transaction's hashes
 *
 */
export interface MallocClient<
  SpecialAccountTypeGeneric extends SpecialAccount
> {
  contractAccountId: AccountId;
  runEphemeralSplitter: CallEphemeralFn<
    SpecialAccountTypeGeneric extends SpecialAccountConnectedWallet
      ? void
      : string[]
  >;
  deposit: DepositFn<
    SpecialAccountTypeGeneric extends SpecialAccountConnectedWallet
      ? void
      : string
  >;
  resolveTransactions: ResolveTransactionsFn;
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

export type SpecialAccount =
  | SpecialAccountConnectedWallet
  | SpecialAccountWithKeyPair;

export enum TransactionWithPromiseResultFlag {
  SUCCESS = "success",
  FAILURE = "failure",
  PENDING = "pending",
}

export interface TransactionWithPromiseResult {
  flag: TransactionWithPromiseResultFlag;
  message?: string;
}

export interface MallocError {
  message: string;
}
