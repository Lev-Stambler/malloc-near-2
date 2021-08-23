import {
  ActionOrConstructionWithSplitParametersFilled,
  ActionOutputsForConstruction,
  ActionOutputsForConstructionWithParamsFilled,
  BindedParameter,
  GenericParameters,
} from "../interfaces";
import { BINDED_PARAMETER_TYPE, BindParameter } from "../parameter";

// TODO: test parameter replacement
/**
 * Resolve all parameters to their final values.
 * So, the return should have no binded parameters
 *
 * @returns Generic Parameters without any binded values. It also merges the parent and child parameters
 */
export const resolveParameters = (
  parameters: GenericParameters,
  parentParameters?: GenericParameters
): GenericParameters => {
  const _parentParams = parentParameters || {};

  const resolvedParams = Object.keys(parameters).reduce((prior, k) => {
    if (isBinded(parameters[k])) {
      const bind = parameters[k] as BindedParameter;
      const parentVal = _parentParams[bind.name];
      if (!parentVal)
        throw `Expected the parameter ${k} to have parameter ${bind.name} in its parent's parameters`;
      prior[k] = parentVal;
      return prior;
    } else {
      return prior;
    }
  }, parameters);
  if (hasBinded(resolveParameters)) {
    throw "Not all binded parameters were resolved";
  }
  return { ..._parentParams, ...parameters, ...resolvedParams };
};

export const fillFractionSplitsAndToken = (
  actionOutput: ActionOutputsForConstruction,
  params: GenericParameters
): ActionOutputsForConstructionWithParamsFilled => {
  return actionOutput.map((outputsForTok) => {
    // First guess that the tokenId is a parameter. If no such parameter exists, assume that it is the raw token id
    // const outputsForTok = actionOutput[tokenIdOrParam];
    const tokenIdOrParam = outputsForTok.token_id;
    const tokenIdOut = !tokenIdOrParam
      ? undefined
      : (tokenIdOrParam as BindedParameter).type === BINDED_PARAMETER_TYPE
      ? params[(tokenIdOrParam as BindedParameter).name]
      : (tokenIdOrParam as string);

    if (!params.tokenIn && !tokenIdOut) {
      throw "Expected a token in to be specified either in the out of a construction or within the given element";
    }
    const paramsWithToken: GenericParameters = {
      tokenIn: tokenIdOut,
      ...params,
    };
    const withSplitsFilled: ActionOrConstructionWithSplitParametersFilled[] =
      outputsForTok.next.map((o) => {
        // If the fraction part is a string, assume that it needs to be filled in
        // TODO: allow for BigNumbers which are passed in as strings, this could be via checking for the first char being a digit
        if ((o.fraction as BindedParameter).type === BINDED_PARAMETER_TYPE) {
          const name = (o.fraction as BindedParameter).name;
          const val = params[name];
          if (!val) throw `Expected param here for parameter ${name}`;
          else if (typeof val !== "number" && typeof val !== "string")
            throw "Expected the parameter for fraction to be a number or string";
          return {
            element: o.element(paramsWithToken),
            fraction: val as number | string,
          };
        }
        return {
          element: o.element(paramsWithToken),
          fraction: o.fraction as number,
        };
      });
    return {
      next: withSplitsFilled,
      token_id: tokenIdOut,
    };
  }, {} as ActionOutputsForConstructionWithParamsFilled);
};

const hasBinded = (parameters: GenericParameters): boolean =>
  Object.keys(parameters).some((k) => isBinded(parameters[k]));

const isBinded = (v: any) => v?.type === BINDED_PARAMETER_TYPE;
