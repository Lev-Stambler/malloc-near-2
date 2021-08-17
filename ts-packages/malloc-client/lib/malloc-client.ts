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
  ExecuteMultipleTxOpts,
  NodeTypes,
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
import { getTokenBalance } from "./ft-token";
import { registerDepositsTxs } from "./storage-deposit";
import { getMallocCallMetadata } from "./node";

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

interface RegisterAccountDepositsOpts {
  extraAmount?: BigNumberish;
  executeTransactions?: boolean;
}

export interface IRunEphemeralConstruction {
  nodes: Node<NodeTypes>[];
  amount: string;
  initialNodeIndices: number[];
  initialSplits: number[];
  nextNodesIndices: number[][][];
  nextNodesSplits: number[][][];
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
    // this.contract = new Contract(account, mallocAccountId, {
    //   viewMethods: [],
    //   changeMethods: [
    //     "register_nodes",
    //     "register_construction",
    //     "init_construction",
    //     "process_next_node_call",
    //   ],
    // });
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

  public async runEphemeralConstruction({
    nodes,
    amount,
    initialNodeIndices: initial_node_indices,
    initialSplits: initial_splits,
    nextNodesIndices: next_nodes_indices,
    nextNodesSplits: next_nodes_splits,
    opts,
  }: IRunEphemeralConstruction): Promise<string[]> {
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

    console.log("AAAAA");
    //@ts-ignore
    // await this.contract.register_nodes(
    //   {
    //     node_names: ["a", "a", "a"],
    //     nodes: nodes,
    //   },
    //   MAX_GAS
    // );
    // const ret = await this.account.functionCall({
    //   contractId: this.mallocAccountId,
    //   methodName: "register_nodes",
    //   args: {
    //     node_names: ["a", "a", "a"],
    //     nodes: nodes,
    //   },
    //   gas: MAX_GAS,
    // })
    // console.log(ret)
    // return []

    // if (this.account.type !== SpecialAccountType.KeyPair)
    //   throw "Malloc client currently only supports keypair connected wallets";
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
