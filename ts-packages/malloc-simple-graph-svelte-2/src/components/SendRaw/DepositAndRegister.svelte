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

  let amount: string = "100000000000000000000";
  let token_id: string = "wrap.testnet";
  let accountToRegister: string = "[]";
  let accountsToRegisterWith: string = "[]";

  const registerDepositForm = formVal(
    () => ({
      amount: { value: amount, validators: ["required"] },
    }),

    { validateOnChange: false }
  );

  afterUpdate(() => {
    registerDepositForm.validate();
  });

  const submit = async (e: Event) => {
    e.preventDefault();
    try {
      const client: MallocClient<SpecialAccountConnectedWallet> =
        $nearStore.mallocClient;
      // TODO: type check or smthng
      const accountsToRegister: string[] = JSON.parse(accountToRegister);
      const { txs: registerTxs } = await client.registerAccountDeposits(
        [token_id, ...JSON.parse(accountsToRegisterWith)],
        [
          $nearStore.config.contractName,
          $nearStore.account.accountId,
          ...accountsToRegister,
        ]
      );
      console.log(registerTxs);
      await client.deposit(amount, token_id, registerTxs, {
        callbackUrl: window.location.href,
      });
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
        <Textfield
          bind:value={amount}
          label="Amount in the the currency"
        >
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
          bind:value={accountToRegister}
          type="string"
          label="array of accounts to register"
        />
      </div>
      <div>
        <Textfield
          bind:value={accountsToRegisterWith}
          type="string"
          label="array of accounts to register with"
        />
      </div>
      <button disabled={!$registerDepositForm.valid}
        >Register and deposit</button
      >
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
