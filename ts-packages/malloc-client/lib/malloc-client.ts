import {
  Account,
  ConnectedWalletAccount,
  Contract,
  KeyPair,
  Near,
  WalletConnection,
} from "near-api-js";
import { MallocErrors } from "./errors";
import {
  AccountId,
  SpecialAccountWithKeyPair,
  Action,
  SpecialAccountConnectedWallet,
  SpecialAccountType,
  SpecialAccount,
  TransactionWithPromiseResultFlag,
  TransactionWithPromiseResult,
  Transaction,
  ConstructionCallId,
  ConstructionId,
  TxHashOrVoid,
  ConstructionCall,
  BigNumberish,
  MallocCallMetadata,
  ExecuteMultipleTxOpts,
  ActionTypesLibraryFacing,
  WithdrawToArgs,
} from "./interfaces";
import {
  deleteConstruction,
  getConstructionCallData,
  runEphemeralConstruction,
} from "./construction";
import {
  executeMultipleTx,
  MAX_GAS,
  resolveTransactionsReducedWithPromises,
  resolveTransactionsWithPromise,
} from "./tx";
import { getTokenBalance, TransferTypeTransfer } from "./ft-token";
import { registerDepositsTxs } from "./storage-deposit";
import { getMallocCallMetadata } from "./action";

export * from "./interfaces";

export const wrapAccountConnectedWallet = (
  near: Near
): SpecialAccountConnectedWallet => {
  const newNear = new Near(near.config);
  const walletConnection = new WalletConnection(newNear, null);
  const account = new ConnectedWalletAccount(
    walletConnection,
    walletConnection.account().connection,
    walletConnection.account().accountId
  );

  (account as any).type = SpecialAccountType.WebConnected;
  //@ts-ignore
  return account;
};

// TODO: may need same new thingy as above
export const wrapAccountKeyPair = (
  account: Account,
  keypair: KeyPair
): SpecialAccountWithKeyPair => {
  const newAccountKP = new Account(account.connection, account.accountId);
  (newAccountKP as any).type = SpecialAccountType.KeyPair;
  (newAccountKP as any).keypair = keypair;
  // @ts-ignore
  return newAccountKP as SpecialAccountWithKeyPair;
};

interface RunEphemeralOpts {
  gas: BigNumberish;
  depositTransactionHash: string;
}

interface MallocClientOpts {}

const mallocClientDefaultOpts: MallocClientOpts = {};

/**
 * @param extraAmount - The extra amount in Near Lamports to give to each deposit
 * @param executeTransactions - Whether to execute the transactions or simply just return an array of transactions
 */
interface RegisterAccountDepositsOpts {
  extraAmount?: BigNumberish;
  executeTransactions?: boolean;
}

export interface IRunEphemeralConstruction {
  actions: Action<ActionTypesLibraryFacing>[];
  amount: string;
  initialActionIndices: number[];
  initialSplits: number[];
  nextActionsIndices: number[][][];
  nextActionsSplits: number[][][];
  opts?: Partial<RunEphemeralOpts>;
}

/**
 * MallocClient is the for interacting with the set of Malloc Contracts via the Malloc SDK
 *
 * @param SpecialAccountTypeGeneric the type of special account. If the special account is a web connected wallet, then
 * deposit and runEphemeralConstruction do not return. If they are accounts derived from a key pair, then they return the transaction's hashes
 *
 */
export class MallocClient<
  AccountType extends SpecialAccountWithKeyPair | SpecialAccountConnectedWallet
> {
  private readonly account: AccountType;
  public readonly mallocAccountId: AccountId;
  private readonly opts: MallocClientOpts;
  // private readonly contract: Contract;

  constructor(
    account: AccountType,
    mallocAccountId: AccountId,
    opts?: Partial<MallocClientOpts>
  ) {
    this.account = account;
    this.mallocAccountId = mallocAccountId;
    this.opts = opts
      ? { ...mallocClientDefaultOpts, ...opts }
      : mallocClientDefaultOpts;
  }

  public async resolveTransactions(
    hashes: string[]
  ): Promise<TransactionWithPromiseResult> {
    return resolveTransactionsReducedWithPromises(
      hashes,
      this.account.accountId
    );
  }

  public async withdraw(
    amount: string,
    tokenAccountId: string,
    opts?: ExecuteMultipleTxOpts<AccountType>
  ): Promise<TxHashOrVoid<AccountType>> {
    let txs: Transaction[] = [];
    txs.push({
      receiverId: this.mallocAccountId,
      functionCalls: [
        {
          methodName: "withdraw_to",
          amount: "1",
          args: {
            account_id: this.account.accountId,
            amount: amount,
            token_id: tokenAccountId,
            recipient: this.account.accountId,
            transfer_type: TransferTypeTransfer(),
          } as WithdrawToArgs,
        },
      ],
    });
    const ret = await executeMultipleTx(this.account, txs, opts);
    //@ts-ignore
    if (!ret || !ret?.length) return;

    return (ret as string[])[0] as TxHashOrVoid<AccountType>;
  }

  public async deposit(
    amount: string,
    tokenAccountId: string,
    registerAccountDepositTransactions?: Transaction[],
    opts?: ExecuteMultipleTxOpts<AccountType>
  ): Promise<TxHashOrVoid<AccountType>> {
    let txs: Transaction[] = [];
    txs.push({
      receiverId: tokenAccountId,
      functionCalls: [
        {
          methodName: "ft_transfer_call",
          amount: "1",
          args: {
            receiver_id: this.mallocAccountId,
            amount: amount.toString(),
            msg: "",
          },
        },
      ],
    });
    if (registerAccountDepositTransactions) {
      txs = [...registerAccountDepositTransactions, ...txs];
    }
    const ret = await executeMultipleTx(this.account, txs, opts);
    //@ts-ignore
    if (!ret || !ret?.length) return;

    return (ret as string[])[0] as TxHashOrVoid<AccountType>;
  }

  public getMallocCallMetadata(
    mallocCallId: AccountId
  ): Promise<MallocCallMetadata> {
    return getMallocCallMetadata(this.account, mallocCallId);
  }

  /**
   * @param accountId - Account Balance to check
   * @param tokenId
   * @param mallocCallId - If this is set, then the balance of a malloc call will be
   * checked rather than the main Malloc Contract
   */
  public getTokenBalance(
    accountId: AccountId,
    tokenId: AccountId,
    mallocCallId?: string
  ): Promise<string> {
    return getTokenBalance(
      this.account,
      mallocCallId || this.mallocAccountId,
      accountId,
      tokenId
    );
  }

  public deleteConstruction(
    constructionID: ConstructionId
  ): Promise<TxHashOrVoid<AccountType>> {
    return deleteConstruction(
      this.account,
      this.mallocAccountId,
      constructionID
    );
  }

  public getConstructionCallData(
    constructionCallID: ConstructionCallId
  ): Promise<ConstructionCall> {
    return getConstructionCallData(
      this.account,
      this.mallocAccountId,
      constructionCallID
    );
  }

  /**
   * See {@link runEphemeralConstruction}
   */
  public async runEphemeralConstruction({
    actions,
    amount,
    initialActionIndices: initial_action_indices,
    initialSplits: initial_splits,
    nextActionsIndices: next_actions_indices,
    nextActionsSplits: next_actions_splits,
    opts,
  }: IRunEphemeralConstruction): Promise<string[]> {
    // Wait for the deposit transactions to go through
    if (opts?.depositTransactionHash) {
      const depositResult = await resolveTransactionsWithPromise(
        [opts.depositTransactionHash],
        this.account.accountId
      );
      if (depositResult[0].flag !== TransactionWithPromiseResultFlag.SUCCESS) {
        throw MallocErrors.TRANSACTION_PROMISE_FAILED(depositResult[0].message);
      }
    }

    return await runEphemeralConstruction(
      this.account as SpecialAccountWithKeyPair,
      this.mallocAccountId,
      actions,
      amount,
      initial_action_indices,
      initial_splits,
      next_actions_indices,
      next_actions_splits,
      opts
    );
    // return txRets;
  }

  /**
   * @param  {AccountId[]} contracts A list of the token contract account ids
   * @param  {AccountId[]} registerForAccounts The accounts to register for all the token contracts
   * @param  {RegisterAccountDepositsOpts} opts - {@link RegisterAccountDepositsOpts}
   * @returns A list of token account ids which were newly registered
   */
  public async registerAccountDeposits(
    contracts: AccountId[],
    registerForAccounts: AccountId[],
    opts?: RegisterAccountDepositsOpts
  ): Promise<{ txs: Transaction[]; contractsToRegisterWith: AccountId[] }> {
    const { txs, contractsToRegister } = await registerDepositsTxs(
      contracts,
      registerForAccounts,
      this.account,
      opts?.extraAmount
    );
    if (opts?.executeTransactions) {
      await executeMultipleTx(this.account, txs);
    }
    return {
      txs,
      contractsToRegisterWith: contractsToRegister,
    };
  }
}
