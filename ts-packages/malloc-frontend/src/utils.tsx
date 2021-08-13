import {
  connect,
  ConnectedWalletAccount,
  Contract,
  keyStores,
  providers,
  WalletConnection,
} from "near-api-js";
import {
  MallocClient,
  SpecialAccountConnectedWallet,
  SpecialAccountType,
  wrapAccount,
} from "../../malloc-client/lib/malloc-client";
import getConfig, { env, Env } from "./config";
import { MallocContract } from "./types";

const nearConfig = getConfig((process.env.NODE_ENV as Env) || "development");

export const MAX_GAS = "300000000000000";

export const provider = new providers.JsonRpcProvider(getConfig(env).nodeUrl);

// Initialize contract & set global variables
export async function initContract() {
  // Initialize connection to the NEAR testnet
  const near = await connect(
    Object.assign(
      { deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() } },
      nearConfig
    )
  );

  // Initializing Wallet based Account. It can work with NEAR testnet wallet that
  // is hosted at https://wallet.testnet.near.org
  window.walletConnection = new WalletConnection(near, "Malloc");
  window.account = wrapAccount<ConnectedWalletAccount>(
    window.walletConnection.account(),
    SpecialAccountType.WebConnected
  ) as SpecialAccountConnectedWallet;

  // Getting the Account ID. If still unauthorized, it's just empty string
  window.accountId = window.walletConnection.getAccountId();

  // Initializing our contract APIs by contract name and configuration
  window.contract = (await new Contract(
    window.walletConnection.account(),
    nearConfig.contractName,
    {
      changeMethods: ["run_ephemeral"],
      viewMethods: [],
    }
  )) as any as MallocContract;

  // TODO: env var
  window.mallocClient = new MallocClient(
    window.account,
    "dev-1628729326940-20289955091332"
  );
}

export function logout() {
  window.walletConnection.signOut();
  // reload page
  window.location.replace(window.location.origin + window.location.pathname);
}

export function login() {
  // Allow the current app to make calls to the specified contract on the
  // user's behalf.
  // This works by creating a new access key for the user's account and storing
  // the private key in localStorage.
  window.walletConnection.requestSignIn(nearConfig.contractName);
}
