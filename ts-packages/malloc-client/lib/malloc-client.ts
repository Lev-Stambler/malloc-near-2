import {
  Account,
  ConnectedWalletAccount,
  Contract,
  KeyPair,
} from "near-api-js";
import { MallocErrors } from "./errors";
import {
  AccountId,
  SpecialAccountWithKeyPair,
  Node,
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
import { getTokenBalance } from "./ft-token";
import { registerDepositsTxs } from "./storage-deposit";
import { getMallocCallMetadata } from "./node";

export * from "./interfaces";

export const wrapAccount = <T extends Account | ConnectedWalletAccount>(
  account: T,
  type: SpecialAccountType,
  keypair?: KeyPair
): T extends ConnectedWalletAccount
  ? SpecialAccountConnectedWallet
  : SpecialAccountWithKeyPair => {
  switch (type) {
    case SpecialAccountType.KeyPair:
      if (!keypair)
        throw "A keypair is expected for wrapping a wallet with type Key Pair";
      const newAccountKP = new Account(account.connection, account.accountId);
      (newAccountKP as any).type = SpecialAccountType.KeyPair;
      (newAccountKP as any).keypair = keypair;
      // @ts-ignore
      return newAccountKP as SpecialAccountWithKeyPair;
    case SpecialAccountType.WebConnected:
      const newAccountWeb = new ConnectedWalletAccount(
        (account as ConnectedWalletAccount).walletConnection,
        account.connection,
        account.accountId
      );
      (newAccountWeb as any).type = SpecialAccountType.WebConnected;
      // @ts-ignore
      return newAccountWeb as SpecialAccountConnectedWallet;
  }
};

interface RunEphemeralOpts {
  gas: BigNumberish;
  depositTransactionHash: string;
}

interface MallocClientOpts {}

const mallocClientDefaultOpts: MallocClientOpts = {};
interface RegisterAccountDepositsOpts {
  extraAmount: BigNumberish;
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
  public async deposit(
    amount: string,
    tokenAccountId: string
  ): Promise<TxHashOrVoid<AccountType>> {
    const txs: Transaction[] = [];
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
    const ret = await executeMultipleTx(this.account, txs);
    //@ts-ignore
    if (!ret || !ret?.length) return;

    return (ret as string[])[0] as TxHashOrVoid<AccountType>;
  }

  public getMallocCallMetadata(
    mallocCallId: AccountId
  ): Promise<MallocCallMetadata> {
    return getMallocCallMetadata(this.account, mallocCallId);
  }

  public getTokenBalance(
    accountId: AccountId,
    tokenId: AccountId
  ): Promise<string> {
    return getTokenBalance(
      this.account,
      this.mallocAccountId,
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

  // TODO:
  public async runEphemeralConstruction(
    nodes: Node[],
    amount: string,
    initial_node_indices: number[],
    initial_splits: number[],
    next_nodes_indices: number[][][],
    next_nodes_splits: number[][][],
    opts?: Partial<RunEphemeralOpts>
  ): Promise<string[]> {
    // Wait for the deposit transactions to go through
    if (opts?.depositTransactionHash) {
      const depositResult = await resolveTransactionsWithPromise(
        [opts.depositTransactionHash],
        this.account.accountId
      );
      if (depositResult[0].flag !== TransactionWithPromiseResultFlag.SUCCESS) {
        throw MallocErrors.transactionPromiseFailed(depositResult[0].message);
      }
    }

    if (this.account.type !== SpecialAccountType.KeyPair)
      throw "Malloc client currently only supports keypair connected wallets";
    return await runEphemeralConstruction(
      this.account as SpecialAccountWithKeyPair,
      this.mallocAccountId,
      nodes,
      amount,
      initial_node_indices,
      initial_splits,
      next_nodes_indices,
      next_nodes_splits,
      opts
    );
    // return txRets;
  }

  /**
   * @param  {AccountId[]} contracts A list of the token contract account ids
   * @param  {AccountId[]} registerForAccounts The accounts to register for all the token contracts
   * @param  {RegisterAccountDepositsOpts} opts?
   * @returns A list of token account ids which were newly registered
   */
  public async registerAccountDeposits(
    contracts: AccountId[],
    registerForAccounts: AccountId[],
    opts?: RegisterAccountDepositsOpts
  ): Promise<AccountId[]> {
    const { txs, contractsToRegister } = await registerDepositsTxs(
      contracts,
      registerForAccounts,
      this.account,
      opts?.extraAmount
    );
    await executeMultipleTx(this.account, txs);
    return contractsToRegister;
  }
}
