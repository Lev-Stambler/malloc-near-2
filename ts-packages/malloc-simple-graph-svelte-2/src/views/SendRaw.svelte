<script lang="ts">
  import Textfield from "@smui/textfield";
  import Icon from "@smui/textfield/icon";
  import {
    SpecialAccountType,
    MallocClient,
    wrapAccountConnectedWallet,
    SpecialAccountConnectedWallet,
  } from "@malloc/sdk";
  import HelperText from "@smui/textfield/helper-text/index";

  import { afterUpdate } from "svelte";

  import { form as formVal, bindClass } from "svelte-forms";
  import { nearStore } from "src/stores/near-store";
  import { SCHEMA } from "near-api-js/lib/transaction";
  import DepositAndRegister from "src/components/SendRaw/DepositAndRegister.svelte";
  import { parseQuery } from "src/utils/browser";
  import RunEphemeral from "src/components/SendRaw/RunEphemeral.svelte";

  let step: "deposit" | "runEphemeral" = "deposit";
  let depositHash: string = null;

  let amount: string = null;
  let token_id: string = null;
  const submit = async (e: Event) => {
    e.preventDefault();
    try {
      const client: MallocClient<SpecialAccountConnectedWallet> =
        $nearStore.mallocClient;
      console.log(SCHEMA);
      await client.deposit(amount, token_id);
    } catch (e) {
      alert("an error occured in trying to submit: " + JSON.stringify(e || {}));
      console.error(e);
    }
  };

  async function init() {
    const url = window.location.search;
    if (!url) return;
    const parsed = parseQuery(url);
    if (!parsed.transactionHashes) return;
    const txHashes = parsed.transactionHashes.split(",");
    depositHash = txHashes[txHashes.length - 1];
    step = "runEphemeral";
  }
</script>

{#await init()}
  Loading...
{:then value}
  <div class="wrapper">
    {#if step === "deposit"}
      <DepositAndRegister />
    {:else}
      <RunEphemeral {depositHash} />
    {/if}
  </div>

  <style>
    .wrapper {
      padding: 1rem;
    }
    form {
      justify-content: left;
    }
  </style>
{:catch error}
  Failed to load with {JSON.stringify(error)}
{/await}
