import { AccountId } from "./shared";

export interface MallocCall {
  check_callback?: boolean;
  malloc_call_id: AccountId;
  json_args: string;
  skip_ft_transfer?: boolean;
  token_id: AccountId;
}

export interface MallocCallWithGasAndAttached extends MallocCall {
  gas: number;
  attached_amount: string;
}

export interface FtTransferCallToMallocCall {
  malloc_call_id: AccountId;
  token_id: AccountId;
}

export interface WithdrawFromMallocCall {
  malloc_call_id: AccountId;
  token_id: AccountId;
  recipient?: AccountId;
}

export interface Action<
  T extends ActionTypesLibraryFacing | ActionTypesContractFacing
> {
  // SimpleTransfer?: { recipient: AccountId };
  // FTTransfer?: { recipient: AccountId };
  MallocCall?: T extends MallocCallWithGasAndAttached
    ? MallocCallWithGasAndAttached
    : T extends MallocCall
    ? MallocCall
    : undefined;
  FtTransferCallToMallocCall?: T extends MallocCall
    ? undefined
    : T extends FtTransferCallToMallocCall
    ? FtTransferCallToMallocCall
    : undefined;
  WithdrawFromMallocCall?: T extends MallocCall
    ? undefined
    : T extends WithdrawFromMallocCall
    ? WithdrawFromMallocCall
    : undefined;
}

export type ActionTypesLibraryFacing =
  | FtTransferCallToMallocCall
  | MallocCall
  | WithdrawFromMallocCall;

export type ActionTypesContractFacing =
  | FtTransferCallToMallocCall
  | WithdrawFromMallocCall
  | MallocCallWithGasAndAttached;
