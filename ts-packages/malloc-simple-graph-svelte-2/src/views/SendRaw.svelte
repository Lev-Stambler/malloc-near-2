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

  let amount: string = null;
  let token_id: string = null;
  let initial_node_indices: string = null;
  let initial_splits: string = null;
  let next_nodes_indices: string = null;
  let next_nodes_splits: string = null;

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
      console.log(SCHEMA);
      const tx = await client.deposit(amount, token_id);
    } catch (e) {
      alert("an error occured in trying to submit: " + JSON.stringify(e || {}));
      console.error(e);
    }
  };
</script>

<div class="wrapper">
  <form on:submit={submit}>
    <div>
      <!-- TODO: parsing -->
      <div>
        <Textfield bind:value={amount} label="Amount in the the full currency">
          <Icon class="material-icons" slot="leadingIcon">event</Icon>
        </Textfield>
      </div>
      <div>
        <Textfield bind:value={token_id} label="Token Account">
          <Icon class="material-icons" slot="leadingIcon">event</Icon>
        </Textfield>
      </div>
      <div>
        <Textfield
          bind:value={initial_node_indices}
          label="Initial Node Indices (1-D array of indices into the nodes array)"
        >
          <Icon class="material-icons" slot="leadingIcon">event</Icon>
        </Textfield>
      </div>
      <div>
        <Textfield
          bind:value={initial_splits}
          label="Initial Splits for the the initial node indices"
        >
          <Icon class="material-icons" slot="leadingIcon">event</Icon>
        </Textfield>
      </div>
      <div>
        <Textfield
          bind:value={next_nodes_indices}
          label="A 3D array of node indices to follow nodes"
        >
          <Icon class="material-icons" slot="leadingIcon">event</Icon>
        </Textfield>
      </div>
      <div>
        <Textfield
          bind:value={next_nodes_splits}
          label="A 3D array of splits to follow nodes"
        >
          <Icon class="material-icons" slot="leadingIcon">event</Icon>
        </Textfield>
      </div>

      <button disabled={!$sendRawForm.valid}>Login</button>
    </div>
  </form>
</div>

<style>
  .wrapper {
    padding: 1rem;
  }
  form {
    justify-content: left;
  }
</style>
