import { Account } from "near-api-js";
import {
  AccountId,
  RunEphemeralOpts,
  Splitter,
  Transaction,
} from "./interfaces";

const defaultRunEphemeralOpts: RunEphemeralOpts = {
  checkSuccessful: false,
};

export const runEphemeralSplitter = async (
  callerAccount: Account,
  mallocAccountId: AccountId,
  splitter: Splitter,
  opts?: Partial<RunEphemeralOpts>
): Promise<Transaction[]> => {
  const _opts: RunEphemeralOpts = {
    ...defaultRunEphemeralOpts,
    ...(opts || {}),
  };
  return [];
};
