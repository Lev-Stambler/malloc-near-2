import { BindedParameter, GenericParameters } from "../interfaces";
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
  return { ..._parentParams, ...parameters };
};

const hasBinded = (parameters: GenericParameters): boolean =>
  Object.keys(parameters).some((k) => isBinded(parameters[k]));

const isBinded = (v: any) => v?.type === BINDED_PARAMETER_TYPE;
