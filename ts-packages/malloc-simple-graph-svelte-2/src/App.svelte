<script lang="ts">
  import {
    connect,
    ConnectedWalletAccount,
    keyStores,
    WalletConnection,
  } from "near-api-js";
  import Login from "./components/Login.svelte";
  import { initNearStore, nearStore } from "./stores/near-store";
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
    await initNearStore(near);

    // Initializing Wallet based Account. It can work with NEAR testnet wallet that
    // is hosted at https://wallet.testnet.near.org
  }
  function logout() {
    $nearStore.walletConnection.signOut();
    window.location.reload();
  }
</script>

<main>
  {#await init()}
    loading...
  {:then value}
    {#if $nearStore?.walletConnection.isSignedIn()}
      <button class="log-out" on:click={logout}>Logout</button>
      Logged In
    {:else}
      <Login />
    {/if}
  {:catch error}
    An error occured {JSON.stringify(error)}
    <!-- init() was rejected -->
  {/await}
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
