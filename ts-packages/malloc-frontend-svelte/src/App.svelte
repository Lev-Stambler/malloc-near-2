<script lang="ts">
import { initNearStore, nearStore } from "./stores/near-store";


  let name: string = "world";

  async function init(): Promise<boolean> {
    return false;
  }

	async function login() {
		await initNearStore()
	}
</script>

<main>
  {#await init()}
    <!-- init() is pending -->
    loading...
  {:then loggedIn}
    {#if loggedIn}
      <!-- content here -->
    {:else}
      <h1>Welcome to NEAR!</h1>
      <p>
        To make use of the NEAR blockchain, you need to sign in. The button
        below will sign you in using NEAR Wallet.
      </p>
      <p>
        By default, when your app runs in "development" mode, it connects to a
        test network ("testnet") wallet. This works just like the main network
        ("mainnet") wallet, but the NEAR Tokens on testnet aren't convertible to
        other currencies – they're just for testing!
      </p>
      <p>Go ahead and click the button below to try it out:</p>
      <p>
        <button onClick={login}>Sign in</button>
      </p>
    {/if}
    <!-- init() was fulfilled -->
  {:catch error}
    <!-- init() was rejected -->
  {/await}
</main>

<style lang="scss">
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;

    h1 {
      color: #ff3e00;
      text-transform: uppercase;
      font-size: 4em;
      font-weight: 100;
    }

    @media (min-width: 640px) {
      max-width: none;
    }
  }
</style>
