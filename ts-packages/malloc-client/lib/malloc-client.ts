import {
  Account,
  ConnectedWalletAccount,
  Contract,
  KeyPair,
  Near,
  utils,
  WalletConnection,
} from "near-api-js";
import { MallocErrors } from "./errors";
import {
  AccountId,
  SpecialAccountWithKeyPair,
  TxAction,
  SpecialAccountConnectedWallet,
  SpecialAccountType,
  SpecialAccount,
  TransactionWithPromiseResultFlag,
  TransactionWithPromiseResult,
  Transaction,
  ConstructionCallId,
  ConstructionId,
  TxHashOrUndefined,
  ConstructionCall,
  BigNumberish,
  MallocCallMetadata,
  ExecuteMultipleTxOpts,
  ActionTypesLibraryFacing,
  WithdrawToArgs,
  TxHashesOrUndefined,
  Action,
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
import {
  addAccessKeyForFunctionCalls,
  loadKeyPair,
  storeKeyPair,
} from "./access-key";
import BN from "bn.js";

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
  depositTransactionHashes: string[];
}

interface MallocClientOpts {
  executeTxsByDefault: boolean;
}

const mallocClientDefaultOpts: MallocClientOpts = {
  executeTxsByDefault: false,
};

interface OptsBase<
  AccountType extends SpecialAccountConnectedWallet | SpecialAccountWithKeyPair
> extends ExecuteMultipleTxOpts<AccountType> {
  priorTransactions?: Transaction[];
  executeTransactions?: boolean;
}

interface AddAccessKeyOpts<
  AccountType extends SpecialAccountConnectedWallet | SpecialAccountWithKeyPair
> extends OptsBase<AccountType> {
  allowance?: BigNumberish;
}

interface DefaultReturn<
  AccountType extends SpecialAccountConnectedWallet | SpecialAccountWithKeyPair
> {
  txs: Transaction[];
  hashes?: TxHashesOrUndefined<AccountType>;
}

/**
 * @param extraAmount - The extra amount in Near Lamports to give to each deposit
 * @param executeTransactions - Whether to execute the transactions or simply just return an array of transactions, defaults to true
 */
interface RegisterAccountDepositsOpts<T extends SpecialAccount>
  extends OptsBase<T> {
  extraAmount?: BigNumberish;
}

export interface IRunEphemeralConstruction {
  actions: Action<ActionTypesLibraryFacing>[];
  amount: string;
  initialActionIndices: number[];
  initialSplits: BigNumberish[];
  nextActionsIndices: number[][][];
  nextActionsSplits: BigNumberish[][][];
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
    opts?: OptsBase<AccountType>
  ): Promise<DefaultReturn<AccountType>> {
    let txs: Transaction[] = [];
    txs.push({
      receiverId: this.mallocAccountId,
      actions: [
        {
          functionCall: {
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
        },
      ],
    });
    let hashes: TxHashesOrUndefined<AccountType> | undefined = undefined;
    if (opts?.executeTransactions || this.opts.executeTxsByDefault) {
      hashes = await executeMultipleTx(
        this.account,
        [...(opts?.priorTransactions || []), ...txs],
        opts
      );
    }

    return {
      txs,
      hashes,
    };
  }

  public async addAccessKey(opts?: AddAccessKeyOpts<AccountType>) {
    if (this.account.type !== SpecialAccountType.WebConnected) {
      throw MallocErrors.ONLY_WEB_WALLET_SUPPORTED(
        "Adding an access key for malloc"
      );
    }
    const { tx, kp } = await addAccessKeyForFunctionCalls(
      this.account,
      this.mallocAccountId,
      [
        "register_actions",
        "register_construction",
        "init_construction",
        "process_next_action_call",
        "delete_construction",
      ],
      new BN(
        // this is a couple of hundred calls at max gas for the default
        // TODO: document calculation
        opts?.allowance || (utils.format.parseNearAmount("0.02") as string)
      )
    );
    storeKeyPair(kp);
    let hashes;
    if (opts?.executeTransactions || this.opts.executeTxsByDefault) {
      hashes = await executeMultipleTx(this.account, [tx]);
    }
    return {
      txs: [tx],
      hashes,
    };
  }

  public async deposit(
    amount: string,
    tokenAccountId: string,
    opts?: OptsBase<AccountType>
  ): Promise<DefaultReturn<AccountType>> {
    let txs: Transaction[] = [];
    txs.push({
      receiverId: tokenAccountId,
      actions: [
        {
          functionCall: {
            methodName: "ft_transfer_call",
            amount: "1",
            args: {
              receiver_id: this.mallocAccountId,
              amount: amount.toString(),
              msg: "",
            },
          },
        },
      ],
    });
    if (opts?.priorTransactions) {
      txs = [...opts.priorTransactions, ...txs];
    }
    let hashes;
    if (opts?.executeTransactions || this.opts.executeTxsByDefault) {
      hashes = await executeMultipleTx(this.account, txs, opts);
    }

    if (!hashes || !hashes?.length)
      return {
        txs,
      };

    return {
      txs,
      hashes,
    };
  }

  public executeMultipleTransaction(
    txs: Transaction[],
    opts?: ExecuteMultipleTxOpts<AccountType>
  ): Promise<TxHashesOrUndefined<AccountType>> {
    return executeMultipleTx(this.account, txs, opts);
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

  // TODO: implement delete construction
  public deleteConstruction(
    constructionID: ConstructionId
  ): Promise<TxHashOrUndefined<AccountType>> {
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
    let kp =
      this.account.type === SpecialAccountType.KeyPair
        ? (this.account as SpecialAccountWithKeyPair).keypair
        : loadKeyPair();
    if (!kp) {
      throw MallocErrors.EXPECTED_A_MALLOC_ACCESS_KEY(
        "Running an ephemeral construction"
      );
    }

    // Wait for the deposit transactions to go through
    if (opts?.depositTransactionHashes) {
      const depositResult = await resolveTransactionsWithPromise(
        [...opts.depositTransactionHashes],
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
      kp,
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
    opts?: RegisterAccountDepositsOpts<AccountType>
  ): Promise<
    { contractsToRegisterWith: AccountId[] } & DefaultReturn<AccountType>
  > {
    const { txs, contractsToRegister } = await registerDepositsTxs(
      contracts,
      registerForAccounts,
      this.account,
      opts?.extraAmount
    );
    let hashes;
    if (opts?.executeTransactions || this.opts.executeTxsByDefault) {
      hashes = await executeMultipleTx(this.account, [
        ...(opts?.priorTransactions || []),
        ...txs,
      ]);
    }
    return {
      txs,
      contractsToRegisterWith: contractsToRegister,
      hashes,
    };
  }
}
