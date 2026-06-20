import type { CostEstimate, JobFormState } from "@/lib/marketplace-data"

export type ApiEndpoint =
  | "health"
  | "submit"
  | "pull-work"
  | "submit-result"
  | "settle"
  | "jobs/parse"

export type ApiStubResponse<TReceived = unknown> = {
  ok: true
  endpoint: ApiEndpoint
  message: string
  received?: TReceived
  timestamp: string
}

export type SubmitRequest = {
  spec: JobFormState
  estimate: CostEstimate
}

export type ParseJobRequest = {
  prompt: string
}

export type PullWorkRequest = {
  nodeId: string
  capabilityClass: string
}

export type SubmitResultRequest = {
  tileId: string
  resultHash: string
}

export type SettleRequest = {
  jobId: string
}

export type ApiRequestByEndpoint = {
  health: never
  submit: SubmitRequest
  "pull-work": PullWorkRequest
  "submit-result": SubmitResultRequest
  settle: SettleRequest
  "jobs/parse": ParseJobRequest
}
