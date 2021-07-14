const execSync = require("child_process").execSync;
const path = require("path");
const process = require("process");
const { readFileSync } = require("fs");

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
    `near call ${getDevAccount()} new --accountId=levtester.testnet '{}'`,
    { encoding: "utf-8" }
  );
} catch (e) {
  if (e?.stderr?.indexOf("The contract has already been initialized") === -1)
    throw e;
}
console.log(getDevAccount(), "Deployed")
