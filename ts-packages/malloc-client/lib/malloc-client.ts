import {
  Account,
  ConnectedWalletAccount,
  Contract,
  KeyPair,
} from "near-api-js";
import { registerFtsTxs } from "./ft-token";
import {
  AccountId,
  SpecialAccountWithKeyPair,
  Endpoint,
  MallocClient,
  Splitter,
  SpecialAccountConnectedWallet,
  SpecialAccountType,
} from "./interfaces";
import { runEphemeralSplitter } from "./splitter";
import { executeMultipleTx } from "./tx";

interface MallocClientOpts {}

const mallocClientDefaultOpts: MallocClientOpts = {};

export {
  MallocClient,
  SpecialAccountType,
  SpecialAccountConnectedWallet,
  SpecialAccountWithKeyPair,
} from "./interfaces";

export const wrapAccount = (
  account: Account | ConnectedWalletAccount,
  type: SpecialAccountType,
  keypair?: KeyPair
): SpecialAccountWithKeyPair | SpecialAccountConnectedWallet => {
  switch (type) {
    case SpecialAccountType.KeyPair:
      if (!keypair)
        throw "A keypair is expected for wrapping a wallet with type Key Pair";
      (account as any).type = SpecialAccountType.KeyPair;
      return account as SpecialAccountWithKeyPair;
    case SpecialAccountType.WebConnected:
      (account as any).type = SpecialAccountType.WebConnected;
      return account as SpecialAccountConnectedWallet;
  }
};

export const createMallocClient = async (
  account: SpecialAccountWithKeyPair | SpecialAccountConnectedWallet,
  mallocAccountId: AccountId,
  opts?: MallocClientOpts
): Promise<MallocClient> => {
  return {
    contractAccountId: mallocAccountId,
    runEphemeralSplitter: async (splitter, opts?) => {
      const txs = await runEphemeralSplitter(
        account,
        mallocAccountId,
        splitter,
        opts
      );
      await executeMultipleTx(account, txs);
    },
    registerAccountWithFungibleToken: async (
      tokens,
      registerForAccounts,
      opts
    ) => {
      const { txs, tokensToRegister } = await registerFtsTxs(
        tokens,
        registerForAccounts,
        account
      );
      await executeMultipleTx(account, txs);
      return tokensToRegister;
    },
  };
};
