import { AccountId, Action, ActionTypesLibraryFacing } from "@malloc/sdk";
import {
  ActionOrConstructionWithSplit,
  ActionOrConstructionWithSplitParametersFilled,
  ActionOutputsForConstruction,
  ActionOutputsForConstructionWithParamsFilled,
  IConstruction,
} from "../interfaces";
import { getActionInputToken } from "@malloc/sdk/dist/action";
import { scanlAccum } from "../utils";

export const INTERNAL_CONSTRUCTION_TYPE = "InternalConstruction";

export class _InternalConstruction {
  public readonly type = INTERNAL_CONSTRUCTION_TYPE;

  /**
   * @param initialIndices - indices into actions for what the initial action indices are
   */
  protected constructor(
    public readonly actions: Action<ActionTypesLibraryFacing>[],
    public readonly nextActionsIndices: number[][][],
    public readonly nextActionsSplits: number[][][],
    public readonly initialIndices: number[]
  ) {}

  /**
   * Create an _InternalConstruction from an action without any outputs
   */
  public static fromActionEndpoint(
    action: Action<ActionTypesLibraryFacing>
  ): _InternalConstruction {
    return new _InternalConstruction([action], [[]], [[]], [0]);
  }

  /**
   * Takes in an object with the {@param in} being the input action to the construction
   * and {@param out} being the output action/construction to the input action
   */
  public static fromConstructionInOut(
    inAction: Action<ActionTypesLibraryFacing>,
    out: ActionOutputsForConstructionWithParamsFilled | null
  ): _InternalConstruction {
    if (out === null) {
      return _InternalConstruction.fromActionEndpoint(inAction);
    }

    if (Object.keys(out).length === 0) {
      return _InternalConstruction.fromActionEndpoint(inAction);
    }

    const outputsByToken = Object.keys(out).map((tokenId) => {
      const merged = _InternalConstruction.mergeActionOrConstructionsWithSplits(
        out[tokenId]
      );
      if (merged.internalConstruction === null) {
        throw "Expected the outputs to have at least 1 following action or construction";
      }
      return merged;
    });

    const mergedConstructions = _InternalConstruction.mergeMulti(
      outputsByToken.map((o) => o.internalConstruction)
    );

    if (mergedConstructions === null) {
      throw "Internal error, expected merged construction to not be null";
    }

    const nextSplits = outputsByToken.map((o) => o.splits);

    // TODO: seperate function for like scanl accum
    let totalActions: number[] = scanlAccum(
      outputsByToken.map((o) => o.numberOfNextActionsOrConstructions || 0)
    );

    console.log("TOTAL ACTIONS", totalActions);

    const nextIndices: number[][] = outputsByToken.map((o, tokIndx) => {
      if (!o.internalConstruction) return [];
      const indices: number[] = o.internalConstruction.initialIndices.map(
        (initIndex) => initIndex + totalActions[tokIndx]
      );
      return indices;
      // return indices.map((e, nextActionIndex) => e + totalActions[nextActionIndex]);
    });

    return mergedConstructions.pushActionToParent(
      inAction,
      nextIndices,
      nextSplits
    );
  }

  // Returns null if constructions' length is 0
  public static mergeMulti(
    constructions: (_InternalConstruction | null)[]
  ): _InternalConstruction | null {
    const first = constructions.shift();
    if (!first) return null;
    return constructions.reduce(
      (a: _InternalConstruction | null, b: _InternalConstruction | null) => {
        if (!a && !b) return null;
        else if (!a) return b;
        else if (!b) return a;
        else return a.merge(b);
      },
      first
    );
  }

  protected merge(other: _InternalConstruction): _InternalConstruction {
    // if (other.tokenId !== this.tokenId) {
    //   throw "Expected the input token id's to equal each other";
    // }
    const mergedActions = [...this.actions, ...other.actions];
    const mergedSplits = [
      ...this.nextActionsSplits,
      ...other.nextActionsSplits,
    ];
    const mergedIndices: number[][][] = _InternalConstruction.mergeIndices(
      this.nextActionsIndices,
      other.nextActionsIndices
    );

    const otherInitialIndicesOffset = other.initialIndices.map(
      (i) => i + this.actions.length
    );
    const mergedInitialIndices: number[] = [
      ...this.initialIndices,
      ...otherInitialIndicesOffset,
    ];
    return new _InternalConstruction(
      mergedActions,
      mergedIndices,
      mergedSplits,
      mergedInitialIndices
    );
  }

  protected pushActionToParent(
    action: Action<ActionTypesLibraryFacing>,
    nextActionIndices: number[][],
    nextActionSplits: number[][]
  ): _InternalConstruction {
    return new _InternalConstruction(
      [...this.actions, action],
      [...this.nextActionsIndices, nextActionIndices],
      [...this.nextActionsSplits, nextActionSplits],
      [this.nextActionsIndices.length]
    );
  }

  /**
   * Merge two next node index indices. This is done by offsetting all elements in b by
   * the length of a
   */
  protected static mergeIndices(
    a: number[][][],
    b: number[][][]
  ): number[][][] {
    const bOffset: number[][][] = b.map((b1: number[][]) =>
      b1.map((b2: number[]) => b2.map((index) => index + a.length))
    );
    return [...a, ...bOffset];
  }

  protected static mergeActionOrConstructionsWithSplits(
    actionOrConstWithSplit: ActionOrConstructionWithSplitParametersFilled[]
  ): {
    splits: number[];
    internalConstruction: _InternalConstruction | null;
    numberOfNextActionsOrConstructions: number;
  } {
    const internalConstructions: _InternalConstruction[] =
      actionOrConstWithSplit.map((inp) => {
        const elem = inp.element;
        if (
          (elem as _InternalConstruction).type === INTERNAL_CONSTRUCTION_TYPE
        ) {
          return elem as _InternalConstruction;
        } else {
          // Assume that the element is an endpoint if it is included in a construction as an output
          // TODO: have some type checking system here to make sure that the element is indeed and endpoint
          return _InternalConstruction.fromConstructionInOut(
            elem as Action<ActionTypesLibraryFacing>,
            null
          );
        }
      });

    let newInternalConstruction: _InternalConstruction | null =
      _InternalConstruction.mergeMulti(internalConstructions);

    return {
      splits: actionOrConstWithSplit.map((inp) => inp.fraction),
      internalConstruction: newInternalConstruction,
      numberOfNextActionsOrConstructions: actionOrConstWithSplit.length,
    };
  }
}
