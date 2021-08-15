import {
  ConnectedWalletAccount,
  Connection,
  Near,
  WalletConnection,
} from "near-api-js";
import { wrapAccount, SpecialAccountType, MallocClient } from "@malloc/sdk";
import { writable } from "svelte/store";
import type {
  SpecialAccount,
  SpecialAccountConnectedWallet,
} from "@malloc/sdk";
import getConfig from "src/utils/config";

interface NearStore {
  walletConnection: WalletConnection;
  config: ReturnType<typeof getConfig>;
  account?: SpecialAccount;
  mallocClient?: MallocClient;
}

export const nearStore = writable<null | NearStore>(null);

export const initNearStore = (near: Near) => {
  // TODO: env
  const config = getConfig("development");
  const walletConnection = new WalletConnection(near, "Malloc");

  const account = wrapAccount<ConnectedWalletAccount>(
    walletConnection.account(),
    SpecialAccountType.WebConnected
  ) as SpecialAccountConnectedWallet;

  // Initializing our contract APIs by contract name and configuration
  // window.contract = ((await new Contract(
  //   window.walletConnection.account(),
  //   nearConfig.contractName,
  //   {
  //     changeMethods: ["run_ephemeral"],
  //     viewMethods: [],
  //   }
  // )) as any) as MallocContract;

  // TODO: env var
  const mallocClient = new MallocClient(account, config.contractName);

  nearStore.set({
    walletConnection,
    config,
    mallocClient,
    account,
  });
};
