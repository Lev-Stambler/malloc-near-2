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
export type NextSplitterIndices = number[][][];

export interface Node {
  // SimpleTransfer?: { recipient: AccountId };
  // FTTransfer?: { recipient: AccountId };
  MallocCall?: {
    check_callback?: boolean;
    contract_id: AccountId;
    json_args: string;
    gas: number;
    attached_amount: string;
  };
}

export interface Splitter {
  children: Node[];
  splits: BigNumberish[];
  ft_contract_id?: AccountId;
}


export type TxHashOrVoid<SpecialAccountTypeGeneric> =
  SpecialAccountTypeGeneric extends SpecialAccountConnectedWallet
    ? void
    : string;
export interface MallocCallMetadata {

  minimum_gas?: BN;
  minimum_attached_deposit?: BN;
  name: string;
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

export interface CallEphemeralError {
  constructionCallId?: ConstructionCallId;
  message?: string;
}

export type CallEphemeralFn<T extends string[] | void> = (
  splitter: Splitter[],
  next_splitter_indices: NextSplitterIndices,
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
 * deposit and runEphemeralConstruction do not return. If they are accounts derived from a key pair, then they return the transaction's hashes
 *
 */
export interface MallocClient<
  SpecialAccountTypeGeneric extends SpecialAccount
> {
  contractAccountId: AccountId;
  runEphemeralConstruction: CallEphemeralFn<
    SpecialAccountTypeGeneric extends SpecialAccountWithKeyPair
      ? string[]
      : void
  >;
  deleteConstruction: (
    constructionId: ConstructionId
  ) => Promise<TxHashOrVoid<SpecialAccountTypeGeneric>>;
  getConstructionCallData: (
    constructionCallId: ConstructionCallId
  ) => Promise<ConstructionCall>;
  deposit: DepositFn<TxHashOrVoid<SpecialAccountTypeGeneric>>;
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

export interface ConstructionId {
  owner: AccountId;
  name: string;
}

export type ConstructionCallId = string;

export interface SplitterCallStatus {
  Error?: { message: string };
  // empty enum
  WaitingCall?: any;
  Executing?: { block_index_start: number };
  Success?: any;
}

export interface SplitterCall {
  splitter_index: BigNumberish;
  block_index: BigNumberish;
  amount: BigNumberish;
  status: SplitterCallStatus;
}

export interface ConstructionCall {
  caller: AccountId;
  construction_id: ConstructionId;
  next_splitter_call_stack: number[];
  splitter_calls: SplitterCall[];
}
