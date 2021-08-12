import { ConstructionCallId } from "./shared";

export interface CallEphemeralError {
  constructionCallId?: ConstructionCallId;
  message?: string;
}