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
      return {
        ...(account as Account),
        type: SpecialAccountType.KeyPair,
        keypair,
      } as SpecialAccountWithKeyPair;
    case SpecialAccountType.WebConnected:
      return {
        ...(account as ConnectedWalletAccount),
        type: SpecialAccountType.WebConnected,
      } as SpecialAccountConnectedWallet;
  }
};

export const createMallocClient = async (
  account: SpecialAccountWithKeyPair | SpecialAccountConnectedWallet,
  mallocAccountId: AccountId,
  opts?: MallocClientOpts
): Promise<MallocClient> => {
  return {
    runEphemeralSplitter: async (splitter, opts?) => {
      const txs = await runEphemeralSplitter(
        account,
        mallocAccountId,
        splitter,
        opts
      );
      await executeMultipleTx(account, txs);
    },
    registerAccountWithFungibleToken: async (tokens, registerFor, opts) => {
      const { txs, tokensToRegister } = await registerFtsTxs(
        tokens,
        registerFor,
        account
      );
      await executeMultipleTx(account, txs);
      return tokensToRegister;
    },
  };
};
