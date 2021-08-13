import BN from "bn.js";

export const sumSplits = (splits: number[]): BN =>
  splits.reduce((x, y) => new BN(x).add(new BN(y)), new BN(0)) as BN;
