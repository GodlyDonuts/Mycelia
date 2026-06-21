import type { CostEstimate, JobFormState } from "@/lib/marketplace-data"

export type ApiEndpoint =
  | "health"
  | "submit"
  | "pull-work"
  | "submit-result"
  | "settle"
  | "jobs/parse"

export const API_PATHS: Record<ApiEndpoint, string> = {
  health: "/health",
  submit: "/submit",
  "pull-work": "/pull-work",
  "submit-result": "/submit-result",
  settle: "/settle",
  "jobs/parse": "/jobs/parse",
}

export type ApiSuccessResponse<TData = unknown, TReceived = unknown> = {
  ok: true
  endpoint: ApiEndpoint
  message: string
  data?: TData
  received?: TReceived
  timestamp: string
}

export type ApiErrorResponse = {
  ok: false
  endpoint: ApiEndpoint
  error: string
  details?: string[]
  timestamp: string
}

export type ApiResponse<TData = unknown, TReceived = unknown> =
  | ApiSuccessResponse<TData, TReceived>
  | ApiErrorResponse

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
