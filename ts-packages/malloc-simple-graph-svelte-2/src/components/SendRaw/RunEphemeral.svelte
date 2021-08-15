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
  import { MAX_GAS } from "@malloc/sdk/dist/tx";
  import { exampleCall } from "./exampleCall";

  export let depositHash: string;

  let loading = false;

  let amount: string = exampleCall.amount;
  let token_id: string = "wrap.testnet";
  let initial_node_indices: string = JSON.stringify(
    exampleCall.initial_node_indices
  );
  let initial_splits: string = JSON.stringify(exampleCall.initial_node_splits);
  let next_nodes_indices: string = JSON.stringify(
    exampleCall.next_node_indices
  );
  let next_nodes_splits: string = JSON.stringify(exampleCall.next_node_splits);
  let nodes: string = JSON.stringify(exampleCall.nodes);

  const sendRawForm = formVal(
    () => ({
      amount: { value: amount, validators: ["required"] },
    }),

    { validateOnChange: false }
  );

  afterUpdate(() => {
    sendRawForm.validate();
  });

  const submit = async (e: Event) => {
    e.preventDefault();
    try {
      const client: MallocClient<SpecialAccountConnectedWallet> =
        $nearStore.mallocClient;
      loading = true;
      let ret = await client.runEphemeralConstruction(
        JSON.parse(nodes),
        amount,
        JSON.parse(initial_node_indices),
        JSON.parse(initial_splits),
        JSON.parse(next_nodes_indices),
        JSON.parse(next_nodes_splits),
        {
          depositTransactionHash: depositHash,
          gas: MAX_GAS,
        }
      );
    } catch (e) {
      alert("an error occured in trying to submit: " + JSON.stringify(e || {}));
      console.error(e);
    }
    loading = false;
  };
</script>

{#if loading}
  loading...
{/if}
<div class="wrapper">
  <div class="example">
    <h2>Example Call Parameters</h2>
    <p>{JSON.stringify(exampleCall, null, 2)}</p>
  </div>
  <form on:submit={submit}>
    <div>
      <!-- TODO: parsing -->
      <div>
        <Textfield bind:value={nodes} label="Nodes" textarea />
      </div>
      <div>
        <Textfield
          bind:value={amount}
          label="Amount in the the full currency"
        />
      </div>
      <div>
        <Textfield bind:value={token_id} label="Token Account" />
      </div>
      <div>
        <Textfield
          bind:value={initial_node_indices}
          label="Initial Node Indices (1-D array of indices into the nodes array)"
        />
      </div>
      <div>
        <Textfield
          bind:value={initial_splits}
          label="Initial Splits for the the initial node indices"
        />
      </div>
      <div>
        <Textfield
          bind:value={next_nodes_indices}
          label="A 3D array of node indices to follow nodes"
        />
      </div>
      <div>
        <Textfield
          bind:value={next_nodes_splits}
          label="A 3D array of splits to follow nodes"
        />
      </div>

      <button disabled={!$sendRawForm.valid}>Run Ephemeral</button>
    </div>
  </form>
</div>
