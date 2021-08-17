import { BindedParameter } from "./interfaces";

export const BINDED_PARAMETER_TYPE = "BINDED_PARAMETER";

export const BindParameter = (parameterName: string): BindedParameter => {
  return {
    type: BINDED_PARAMETER_TYPE,
    name: parameterName,
  };
};
