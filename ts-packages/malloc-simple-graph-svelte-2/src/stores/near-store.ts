import {
  ConnectedWalletAccount,
  Connection,
  Near,
  WalletConnection,
} from "@malloc/sdk/dist/near-rexport";
// TODO: change back to package form
import { SpecialAccountType, MallocClient, wrapAccountConnectedWallet } from "@malloc/sdk";
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
  mallocClient?: MallocClient<SpecialAccountConnectedWallet>;
}

export const nearStore = writable<null | NearStore>(null);

export const initNearStore = (near: Near) => {
  // TODO: env
  const config = getConfig("development");

  const account = wrapAccountConnectedWallet(
    near
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
    walletConnection: account.walletConnection,
    config,
    mallocClient,
    account,
  });
};