import { Command, flags } from "@oclif/command";
import { buildAndSimLink, devDeploy } from "../utils";

export default class Hello extends Command {
  static description = "Deploy a contract and optionally call new";

  static examples = [`$ mallocrustcli deploy <PACKAGE DIRECTORY NAME>`];

  static flags = {
    help: flags.help({ char: "h" }),
    // flag with a value (-n, --name=VALUE)
    caller: flags.string({
      char: "c",
      description: "The caller account ID",
    }),
    callNew: flags.string({
      char: "n",
      description: "Stringified JSON arguments for the new call",
    }),
  };

  static args = [{ name: "package" }];

  async run() {
    const { args, flags } = this.parse(Hello);

    let caller = flags.caller || "levtester.testnet";
    // TODO: have some better way to have a default caller w/o being hardcoded
    // if (!flags.caller) {
    // this.error("Expected the -c (caller) flag to be present");
    // }

    if (!args.package) {
      this.error(
        "Expected the last argument to be the package directory (i.e. contract, malloc-calls/error-malloc-calls etc.)"
      );
    }

    const newFlag = flags.callNew ?? null;
    // this.log(`hello ${name} from ./src/commands/.ts`);
    args.package;
    buildAndSimLink(args.package);
    devDeploy(args.package, {
      callNew: newFlag
        ? {
            caller: caller,
            args: JSON.parse(newFlag),
          }
        : undefined,
    });
  }
}
