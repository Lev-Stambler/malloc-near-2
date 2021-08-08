import {
  Account,
  ConnectedWalletAccount,
  Contract,
  KeyPair,
} from "near-api-js";
import { MallocErrors } from "./errors";
import { getTokenBalance, registerFtsTxs } from "./ft-token";
import {
  AccountId,
  SpecialAccountWithKeyPair,
  Node,
  MallocClient,
  Splitter,
  SpecialAccountConnectedWallet,
  SpecialAccountType,
  SpecialAccount,
  TransactionWithPromiseResultFlag,
  TransactionWithPromiseResult,
  Transaction,
  ConstructionCallId,
  ConstructionId,
} from "./interfaces";
import {
  deleteConstruction,
  getConstructionCallData,
  runEphemeralConstruction,
} from "./construction";
import {
  executeMultipleTx,
  resolveTransactionsReducedWithPromises,
  resolveTransactionsWithPromise,
} from "./tx";

interface MallocClientOpts {}

const mallocClientDefaultOpts: MallocClientOpts = {};

export * from "./interfaces";

export const wrapAccount = <T>(
  account: T,
  type: SpecialAccountType,
  keypair?: KeyPair
): SpecialAccount => {
  switch (type) {
    case SpecialAccountType.KeyPair:
      if (!keypair)
        throw "A keypair is expected for wrapping a wallet with type Key Pair";
      (account as any).type = SpecialAccountType.KeyPair;
      (account as any).keypair = keypair;
      // @ts-ignore
      return account as SpecialAccountWithKeyPair;
    case SpecialAccountType.WebConnected:
      (account as any).type = SpecialAccountType.WebConnected;
      // @ts-ignore
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
    ): Promise<TransactionWithPromiseResult> =>
      resolveTransactionsReducedWithPromises(hashes, account.accountId),
    deposit: async (amount, tokenAccountId) => {
      const txs = [];
      txs.push({
        receiverId: tokenAccountId,
        functionCalls: [
          {
            methodName: "ft_transfer_call",
            amount: "1",
            args: {
              receiver_id: mallocAccountId,
              amount: amount.toString(),
              msg: "",
            },
          },
        ],
      });
      return (await executeMultipleTx(account, txs))[0];
    },
    getTokenBalance: (accountId: AccountId, tokenId: AccountId) => getTokenBalance(account, mallocAccountId, accountId, tokenId),
    deleteConstruction: (constructionID: ConstructionId) => deleteConstruction(account, mallocAccountId, constructionID),
    getConstructionCallData: async (constructionCallID: ConstructionCallId) =>
      getConstructionCallData(account, mallocAccountId, constructionCallID),
    // TODO: Ts ignore the return type for now as we are always gonna be returning string[] while only KeyPair
    // wallets are supported
    // @ts-ignore
    runEphemeralConstruction: async (
      splitter,
      next_splitter_indices,
      amount,
      opts?
    ) => {
      // Wait for the deposit transactions to go through
      if (opts?.depositTransactionHash) {
        const depositResult = await resolveTransactionsWithPromise(
          [opts.depositTransactionHash],
          account.accountId
        );
        if (
          depositResult[0].flag !== TransactionWithPromiseResultFlag.SUCCESS
        ) {
          throw MallocErrors.transactionPromiseFailed(depositResult[0].message);
        }
      }

      if (account.type !== SpecialAccountType.KeyPair)
        throw "Malloc client currently only supports keypair connected wallets";
      return await runEphemeralConstruction(
        account as SpecialAccountWithKeyPair,
        mallocAccountId,
        splitter,
        next_splitter_indices,
        amount,
        opts
      );
      // return txRets;
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
