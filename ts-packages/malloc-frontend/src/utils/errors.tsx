import { Endpoint } from "../../../malloc-client/lib/interfaces"

export namespace MallocFrontendErrors {
	export const MalformedEndpoint = (endpoint: Endpoint) => createError(`Endpoint with shape ${JSON.stringify(endpoint)} is malformed`)
}

const createError = (msg: string) => msg