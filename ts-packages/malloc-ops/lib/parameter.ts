import { BindedParameter } from "./interfaces";

export const BindParameter = (parameterName: string): BindedParameter => {
  return {
		type: "BINDED_PARAMETER",
		name: parameterName
	};
};
