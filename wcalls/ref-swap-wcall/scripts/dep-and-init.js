const execSync = require("child_process").execSync;
const path = require("path");
const process = require("process");
const { readFileSync } = require("fs");

const refContract =
  process.argv.length > 2 ? process.argv[2] : "ref-finance.testnet";

execSync(`node ${path.join(__dirname, "../compile.js")}`);

const getDevAccount = () =>
  readFileSync(path.join(__dirname, "../neardev/dev-account"))
    .toString()
    .replace("\n", "");

const output = execSync(
  `near dev-deploy ${path.join(
    __dirname,
    "../target/wasm32-unknown-unknown/release/ref_fi_wcall.wasm"
  )}`,
  { encoding: "utf-8" }
); // the default is 'buffer'
console.log("Output for dev deploy:\n", output);

try {
  execSync(
    `near call ${getDevAccount()} new --accountId=levtester.testnet '{"ref_finance": "${refContract}"}'`,
    { encoding: "utf-8" }
  );
} catch (e) {
  if (e?.stderr?.indexOf("The contract has already been initialized") === -1)
    throw e;
}
console.log(getDevAccount())
// TODO: change this up, and use the near sdk rather than cli
// Then check how much is deposited and if its > 0.5, don't do anything
// const ret = execSync(
//   `near call ${refContract} storage_deposit --accountId=levtester.testnet --amount 0.5 '${JSON.stringify({
//     account_id: getDevAccount(),
//     registration_only: false,
//   })}'`,
//   { encoding: "utf-8" }
// );

// console.log(ret)