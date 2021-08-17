import { AccountId } from "./shared";

export interface MallocCall {
  check_callback?: boolean;
  malloc_call_id: AccountId;
  json_args: string;
  gas: number;
  attached_amount: string;
  skip_ft_transfer?: boolean;
  token_id: AccountId;
}

export interface FtTransferCallToMallocCall {
  malloc_call_id: string;
  token_id: string;
}

export interface Action<T extends ActionTypes> {
  // SimpleTransfer?: { recipient: AccountId };
  // FTTransfer?: { recipient: AccountId };
  MallocCall?: T extends MallocCall ? MallocCall : undefined;
  FtTransferCallToMallocCall?: T extends MallocCall ? undefined : FtTransferCallToMallocCall;
}

export type ActionTypes = FtTransferCallToMallocCall | MallocCall