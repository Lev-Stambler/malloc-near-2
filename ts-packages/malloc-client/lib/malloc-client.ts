import {
  Account,
  ConnectedWalletAccount,
  Contract,
  KeyPair,
} from "near-api-js";
import { MallocErrors } from "./errors";
import { registerFtsTxs } from "./ft-token";
import {
  AccountId,
  SpecialAccountWithKeyPair,
  Endpoint,
  MallocClient,
  Splitter,
  SpecialAccountConnectedWallet,
  SpecialAccountType,
  SpecialAccount,
  TransactionWithPromiseResultFlag,
  TransactionWithPromiseResult,
  Transaction,
} from "./interfaces";
import { runEphemeralSplitter } from "./splitter";
import { executeMultipleTx, resolveTransactionsWithPromise } from "./tx";

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
): SpecialAccount => {
  switch (type) {
    case SpecialAccountType.KeyPair:
      if (!keypair)
        throw "A keypair is expected for wrapping a wallet with type Key Pair";
      (account as any).type = SpecialAccountType.KeyPair;
      (account as any).keypair = keypair;
      return account as SpecialAccountWithKeyPair;
    case SpecialAccountType.WebConnected:
      (account as any).type = SpecialAccountType.WebConnected;
      return account as SpecialAccountConnectedWallet;
  }
};

export const createMallocClient = async <
  T extends SpecialAccountWithKeyPair | SpecialAccountConnectedWallet
>(
  account: T,
  mallocAccountId: AccountId,
  opts?: MallocClientOpts
): Promise<MallocClient<T>> => {
  return {
    contractAccountId: mallocAccountId,
    resolveTransactions: async (
      hashes: string[]
    ): Promise<TransactionWithPromiseResult> => {
      const results = await resolveTransactionsWithPromise(
        hashes,
        account.accountId
      );
      results.forEach((result) => {
        if (result.flag !== "success")
          throw MallocErrors.transactionPromiseFailed(result.message);
      });
      return {
        flag: TransactionWithPromiseResultFlag.SUCCESS,
      };
    },
    runEphemeralSplitter: async (splitter, amount, opts?) => {
      const prependTx: Transaction[] = [];
      if (splitter.ft_contract_id)
        prependTx.push({
          receiverId: splitter.ft_contract_id,
          functionCalls: [
            {
              methodName: "ft_transfer",
              amount: "1",
              args: {
                receiver_id: mallocAccountId,
                amount: amount.toString(),
                msg: "",
              },
            },
          ],
        });
      const mallocTxs = await runEphemeralSplitter(
        account,
        mallocAccountId,
        splitter,
        amount,
        opts
      );
      const txRets = await executeMultipleTx(account, [
        ...prependTx,
        ...mallocTxs,
      ]);
      return txRets;
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
