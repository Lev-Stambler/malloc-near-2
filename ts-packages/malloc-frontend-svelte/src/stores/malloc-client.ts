import { writable } from "svelte/store";
import {
  MallocClient,
  SpecialAccountConnectedWallet,
} from "../../../malloc-client/lib/malloc-client";

export const mallocClient =
  writable<MallocClient<SpecialAccountConnectedWallet> | null>(null);
