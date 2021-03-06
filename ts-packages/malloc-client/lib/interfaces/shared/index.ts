import BN from "bn.js";
import { Account, ConnectedWalletAccount, KeyPair } from "near-api-js";
import {
  AccessKey,
  AccessKeyPermission,
  DeleteKey,
} from "near-api-js/lib/transaction";
import { PublicKey } from "near-api-js/lib/utils";

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

export interface TxAction {
  functionCall?: FunctionCallOptions;
  functionCallAccessKey?: FunctionCallAccessKey;
  deleteKey?: DeleteKey;
}
export interface Transaction {
  receiverId: string;
  actions: TxAction[];
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

export type TxHashesOrUndefined<SpecialAccountTypeGeneric> =
  SpecialAccountTypeGeneric extends SpecialAccountConnectedWallet
    ? undefined
    : string[];

export type TxHashOrUndefined<SpecialAccountTypeGeneric> =
  SpecialAccountTypeGeneric extends SpecialAccountConnectedWallet
    ? undefined
    : string;

export interface ExecuteMultipleTxOpts<
  T extends SpecialAccountConnectedWallet | SpecialAccountWithKeyPair
> {
  callbackUrl?: T extends SpecialAccountConnectedWallet ? string : never;
}

/********** ID interfaces *************/
export type ConstructionCallId = string;
export type ActionCallId = number | string;

interface GenericId {
  owner: AccountId;
  name: string;
}
export type ConstructionId = GenericId;
export type ActionId = GenericId;

export interface ViewFunctionOpts {
  methodName: string;
  args?: object;
}

export interface FunctionCallOptions extends ViewFunctionOpts {
  gas?: string;
  amount?: string;
}

export type FunctionCallAccessKey = {
  accessKey: {
    allowance: string;
    receiverId: string;
    methodNames: string[];
  };
  publicKey: PublicKey;
};

/*********** Error handling *************/
export interface MallocError {
  message: string;
}

/*********** Fungible Token from Malloc Call Core *********/
export interface TransferType {
  Transfer?: [];
  TransferCallMalloc?: [];
}
