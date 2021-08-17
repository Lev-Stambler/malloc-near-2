import { MAX_GAS } from "../../../../malloc-client/lib/tx";

export const exampleCall = {
  actions: [
    {
      FtTransferCallToMallocCall: {
        malloc_call_id: "dev-1628779354953-97648315357960",
        token_id: "wrap.testnet",
      },
    },
    {
      MallocCall: {
        malloc_call_id: "dev-1628779354953-97648315357960",
        token_id: "wrap.testnet",
        check_callback: false,
        skip_ft_transfer: true,
        json_args: JSON.stringify({
          token_out: "ndai.ft-fin.testnet",
          pool_id: 20,
          min_amount_out: "1",
          // TODO: this will be removed
          register_tokens: ["wrap.testnet", "ndai.ft-fin.testnet"],
          recipient: "levtester.testnet",
        }),
        gas: MAX_GAS.divn(100).muln(80).toNumber(),
        // 2/3 rds of max gas and have the remaining third for processing the call
        attached_amount: "0",
      },
    },
    {
      MallocCall: {
        malloc_call_id: "dev-1628779354953-97648315357960",
        token_id: "wrap.testnet",
        check_callback: false,
        skip_ft_transfer: true,
        json_args: JSON.stringify({
          token_out: "banana.ft-fin.testnet",
          pool_id: 11,
          min_amount_out: "1",
          // TODO: this will be removed
          register_tokens: ["ndai.ft-fin.testnet", "wrap.testnet"],
          recipient: "levtester.testnet",
        }),
        // 2/3 rds of max gas and have the remaining third for processing the call
        gas: MAX_GAS.divn(100).muln(80).toNumber(),
        attached_amount: "0",
      },
    },
  ],
  amount: "100000000000000000000",
  initial_action_indices: [0],
  initial_action_splits: [1],
  next_action_indices: [[[1, 2]], [[]], [[]]],
  next_action_splits: [[[1, 1]], [[]], [[]]],
};
