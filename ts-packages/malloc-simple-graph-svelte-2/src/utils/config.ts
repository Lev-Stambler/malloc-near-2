const CONTRACT_NAME = "dev-1628729326940-20289955091332";

export const env: Env = "development";
export type Env =
  | "production"
  | "development"
  | "test"
  | "mainnet"
  | "testnet"
  | "betanet"
  | "local"
  | "ci-betanet"
  | "ci";
export default function getConfig(env: Env) {
  switch (env) {
    case "production":
    case "mainnet":
      return {
        networkId: "mainnet",
        actionUrl: "https://rpc.mainnet.near.org",
        contractName: CONTRACT_NAME,
        walletUrl: "https://wallet.near.org",
        helperUrl: "https://helper.mainnet.near.org",
        explorerUrl: "https://explorer.mainnet.near.org",
      };
    case "development":
    case "testnet":
      return {
        networkId: "testnet",
        actionUrl: "https://rpc.testnet.near.org",
        contractName: CONTRACT_NAME,
        walletUrl: "https://wallet.testnet.near.org",
        helperUrl: "https://helper.testnet.near.org",
        explorerUrl: "https://explorer.testnet.near.org",
      };
    case "betanet":
      return {
        networkId: "betanet",
        actionUrl: "https://rpc.betanet.near.org",
        contractName: CONTRACT_NAME,
        walletUrl: "https://wallet.betanet.near.org",
        helperUrl: "https://helper.betanet.near.org",
        explorerUrl: "https://explorer.betanet.near.org",
      };
    case "test":
    case "ci":
      return {
        networkId: "shared-test",
        actionUrl: "https://rpc.ci-testnet.near.org",
        contractName: CONTRACT_NAME,
        masterAccount: "test.near",
      };
    case "ci-betanet":
      return {
        networkId: "shared-test-staging",
        actionUrl: "https://rpc.ci-betanet.near.org",
        contractName: CONTRACT_NAME,
        masterAccount: "test.near",
      };
    default:
      throw Error(
        `Unconfigured environment '${env}'. Can be configured in src/config.js.`
      );
  }
}
