import type { WalletConnection } from "near-api-js";
import { writable } from "svelte/store";
import type { SpecialAccount } from "@malloc/sdk";

interface NearStore {
  walletConnection: WalletConnection;
  account: SpecialAccount;
}

const account = writable(null);
