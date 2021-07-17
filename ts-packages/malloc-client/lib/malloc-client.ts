import { Account, Contract } from "near-api-js";
import {
  AccountId,
  Endpoint,
  MallocContract,
  Splitter,
  WCallEndpointMetadata,
} from "./interfaces";

interface MallocClientOpts {}

const mallocClientDefaultOpts: MallocClientOpts = {};

interface RunEphemeralOpts {
  checkSuccessful: boolean;
}

const defaultRunEphemeralOpts: RunEphemeralOpts = {
  checkSuccessful: false,
};

export class MallocClient {
  private _opts: MallocClientOpts;
  private contract: MallocContract;

  constructor(
    private nearSignerAccount: Account,
    contractAccountId: AccountId,
    opts?: MallocClientOpts
  ) {
    this._opts = { ...mallocClientDefaultOpts, ...opts };
    this.contract = new Contract(nearSignerAccount, contractAccountId, {
      changeMethods: ["run_ephemeral"],
      viewMethods: [],
    }) as MallocContract;
  }

  public async runEphemeral(splitter: Splitter, opts?: RunEphemeralOpts) {}

  // TODO: you basically have to pass in a bunch of contract ids, then for the
  public async registerFTsForContract(
    contract: AccountId,
    ftContractIds: AccountId[]
  ) {}

  private getFTsUsed(splitter: Splitter): AccountId[] {
    const ftsUsed = [];
    if (splitter.ft_contract_id) ftsUsed.push(splitter.ft_contract_id);
    // splitter.nodes.map(
    throw "";
  }

  //   TODO: how would this work?
  //   private checkSuccess()
}
