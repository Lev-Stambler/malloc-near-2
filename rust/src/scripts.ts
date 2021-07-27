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
import sh from "shelljs";

type DevDeployOpts = {
  callNew?: {
    args: object;
    caller: string;
  };
};

const getContractDir = (packageDir: string): string =>
  join(__dirname, "../../packages", packageDir);

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

  // You can call this script with `node compile.js` or `node compile.js
  // --debug`. Let's set a variable to track whether `--debug` was used.
  const debug = process.argv.pop() === "--debug";

  // You can call this script with `node compile.js` or `node compile.js --debug`.
  // Let's set a variable to track whether `--debug` was used.
  // Note: see other flags in ./cargo/config. Unfortunately, you cannot set the
  // `--target option` in Cargo.toml.
  const buildCmd = debug
    ? "cargo build --target wasm32-unknown-unknown"
    : "cargo build --target wasm32-unknown-unknown --release";

  // Execute the build command, storing exit code for later use
  const { code } = sh.exec(buildCmd);

  // Assuming this is compiled from the root project directory, link the compiled
  // contract to the `out` folder –
  // When running commands like `near deploy`, near-cli looks for a contract at
  // <CURRENT_DIRECTORY>/out/main.wasm
  // TODO: do we want this?
  // if (code === 0 && calledFromDir !== contractDir) {
  //   const linkDir = `${calledFromDir}/out`;
  //   const link = `${calledFromDir}/out/main.wasm`;
  //   const packageName = require("fs")
  //     .readFileSync(`${contractDir}/Cargo.toml`)
  //     .toString()
  //     .match(/name = "([^"]+)"/)[1];
  //   const outFile = join(
  //     contractDir,
  //     `./target/wasm32-unknown-unknown/${
  //       debug ? "debug" : "release"
  //     }/${packageName}.wasm`
  //   );
  //   sh.mkdir("-p", linkDir);
  //   sh.rm("-f", link);
  //   //fixes #831: copy-update instead of linking .- sometimes sh.ln does not work on Windows
  //   sh.cp("-u", outFile, link);
  // }

  // exit script with the same code as the build command
  process.exit(code);
};
