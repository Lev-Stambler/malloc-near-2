// This file does two things:
//
// 1. Compile the Rust contract using cargo (see buildCmd below). This will
//    create a wasm file in the 'build' folder.
// 2. Create a symbolic link (symlink) to the generated wasm file in the root
//    project's `out` folder, for easy use with near-cli.
//
// First, import some helper libraries. `shelljs` is included in the
// devDependencies of the root project, which is why it's available here. It
// makes it easy to use *NIX-style scripting (which works on Linux distros,
// macOS, and Unix systems) on Windows as well.
import { readFileSync } from "fs";
import { join } from "path";
import * as sh from "shelljs";

type DevDeployOpts = {
  callNew?: {
    args: object;
    caller: string;
  };
};

const getContractDir = (packageDir: string): string =>
  join(__dirname, "../../../packages", packageDir);

const getMallocContractDir = (): string =>
  join(__dirname, "../../../packages", "contract");

const getPackageName = (contractDir: string) => {
  const match = readFileSync(`${contractDir}/Cargo.toml`)
    .toString()
    .match(/name = "([^"]+)"/);
  if (!match || match?.length < 2) {
    throw "Failed to read Cargo.toml";
  }
  return match[1];
};

const getDevAccount = (contractDir: string) =>
  readFileSync(join(contractDir, "./neardev/dev-account"))
    .toString()
    .replace("\n", "");

export const getMallocContractDevAccount = () =>
  getDevAccount(getMallocContractDir());

export const devDeploy = (projectDir: string, opts?: DevDeployOpts) => {
  const contractDir = getContractDir(projectDir);
  sh.cd(contractDir);
  const deployCmd = `near dev-deploy ./target/wasm32-unknown-unknown/release/${getPackageName(
    contractDir
  ).replace(/-/g, "_")}.wasm`;
  const { code } = sh.exec(deployCmd);
  if (code !== 0) process.exit(code);

  if (opts?.callNew) {
    const newCmd = `near call ${getDevAccount(contractDir)} new --accountId=${
      opts.callNew.caller
    } '${JSON.stringify(opts.callNew.args)}'`;
    try {
      // TODO: get stderr return and check
      const { code } = sh.exec(newCmd);
    } catch (e) {
      if (
        e?.stderr?.indexOf("The contract has already been initialized") !== -1
      )
        console.log("Looks like the contract has already been initialized");
      else throw e;
    }
  }
};

export const buildAndSimLink = (projectDir: string) => {
  const calledFromDir = sh.pwd().toString();
  const contractDir = getContractDir(projectDir);
  sh.cd(contractDir);

  // You can call this script with `action compile.js` or `action compile.js
  // --debug`. Let's set a variable to track whether `--debug` was used.
  const debug = process.argv.pop() === "--debug";

  // You can call this script with `action compile.js` or `action compile.js --debug`.
  // Let's set a variable to track whether `--debug` was used.
  // Note: see other flags in ./cargo/config. Unfortunately, you cannot set the
  // `--target option` in Cargo.toml.
  const buildCmd = debug
    ? "cargo build --target wasm32-unknown-unknown"
    : "cargo build --target wasm32-unknown-unknown --release";

  // Execute the build command, storing exit code for later use
  const { code } = sh.exec(buildCmd);

  if (code !== 0) process.exit(code);
};

// if (require.main === module) {
//   const projectDir = process.argv.pop();
//   if (!projectDir)
//     throw "Expected the last command line argument to be the package's directory";
//   buildAndSimLink(projectDir);
//   devDeploy(projectDir, {
//     callNew: {
//       caller: "levtester.testnet",
//       args: { ref_finance: "ref-finance.testnet" },
//     },
//   });
// }
