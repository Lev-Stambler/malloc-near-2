import BN from "bn.js";
import { Account, ConnectedWalletAccount, KeyPair } from "near-api-js";

/************* Near Helpers ***************/
export type AccountId = string;
export type BigNumberish = BN | number | string;

/********** Special Accounts **************/
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

/************ Transactions *******************/
export interface Transaction {
  receiverId: string;
  functionCalls: FunctionCallOptions[];
}

export enum TransactionWithPromiseResultFlag {
  SUCCESS = "success",
  FAILURE = "failure",
  PENDING = "pending",
}

export interface TransactionWithPromiseResult {
  flag: TransactionWithPromiseResultFlag;
  message?: string;
}

export type TxHashOrVoid<SpecialAccountTypeGeneric> =
  SpecialAccountTypeGeneric extends SpecialAccountConnectedWallet
    ? void
    : string;

export interface ExecuteMultipleTxOpts<
  T extends SpecialAccountConnectedWallet | SpecialAccountWithKeyPair
> {
  callbackUrl?: T extends SpecialAccountConnectedWallet ? string : never;
}

/********** ID interfaces *************/
export type ConstructionCallId = string;
export type NodeCallId = number | string;

interface GenericId {
  owner: AccountId;
  name: string;
}
export type ConstructionId = GenericId;
export type NodeId = GenericId;

export interface ViewFunctionOpts {
  methodName: string;
  args?: object;
}

export interface FunctionCallOptions extends ViewFunctionOpts {
  gas?: string;
  amount?: string;
}

/*********** Error handling *************/
export interface MallocError {
  message: string;
}
