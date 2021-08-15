<script lang="ts">
  import { connect, ConnectedWalletAccount, keyStores, WalletConnection } from "near-api-js";
import getConfig from "./utils/config";
  export let name: string;
  const nearConfig = getConfig("development");

  async function init() {
    // Initialize connection to the NEAR testnet
    const near = await connect(
      Object.assign(
        { deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() } },
        nearConfig
      )
    );

    // Initializing Wallet based Account. It can work with NEAR testnet wallet that
    // is hosted at https://wallet.testnet.near.org
    // window.walletConnection = new WalletConnection(near, "Malloc");
    // window.account = wrapAccount<ConnectedWalletAccount>(
    //   window.walletConnection.account(),
    //   SpecialAccountType.WebConnected
    // ) as SpecialAccountConnectedWallet;

    // // Getting the Account ID. If still unauthorized, it's just empty string
    // window.accountId = window.walletConnection.getAccountId();

    // // Initializing our contract APIs by contract name and configuration
    // window.contract = (await new Contract(
    //   window.walletConnection.account(),
    //   nearConfig.contractName,
    //   {
    //     changeMethods: ["run_ephemeral"],
    //     viewMethods: [],
    //   }
    // )) as any as MallocContract;

    // // TODO: env var
    // window.mallocClient = new MallocClient(
    //   window.account,
    //   "dev-1628729326940-20289955091332"
    // );
  }
</script>

<main>
  <h1>Hello {name}!</h1>
  <p>
    Visit the <a href="https://svelte.dev/tutorial">Svelte tutorial</a> to learn
    how to build Svelte apps.
  </p>
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>
