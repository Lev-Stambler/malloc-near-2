import { AccountId } from "./shared";

export interface Node {
  // SimpleTransfer?: { recipient: AccountId };
  // FTTransfer?: { recipient: AccountId };
  MallocCall?: {
    check_callback?: boolean;
    malloc_call_id: AccountId;
    json_args: string;
    gas: number;
    attached_amount: string;
    skip_ft_transfer?: boolean;
    token_id: AccountId;
  };
  FtTransferCallToMallocCall?: {
    malloc_call_id: string;
    token_id: string;
  };
}
