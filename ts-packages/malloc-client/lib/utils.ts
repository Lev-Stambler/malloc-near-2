import BN from "bn.js";
import { Splitter } from "./interfaces";

export const sumSplits = (splits: Splitter["splits"]): BN =>
  splits.reduce((x, y) => new BN(x).add(new BN(y)), new BN(0)) as BN;
