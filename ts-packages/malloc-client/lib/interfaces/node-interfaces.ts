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
    token_id: AccountId;
  };
}
