import { connect, keyStores, WalletConnection } from "near-api-js";
import getNearConfig, { NearEnv } from "src/utils/near-config";
import { Writable, writable } from "svelte/store";
const nearConfig = getNearConfig(
  (process.env.NODE_ENV as NearEnv) || "development"
);

interface NearStore {
  walletConnection: WalletConnection;
}

export let nearStore: Writable<NearStore>;

export const initNearStore = async () => {
  const near = await connect(
    Object.assign(
      { deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() } },
      nearConfig
    )
  );
  nearStore = writable<NearStore>({
    walletConnection: new WalletConnection(near, "Malloc"),
  });
};
