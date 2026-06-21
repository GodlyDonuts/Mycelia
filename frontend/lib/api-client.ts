import {
  API_PATHS,
  type ApiEndpoint,
  type ApiRequestByEndpoint,
  type ApiResponse,
  type ParseJobRequest,
  type PullWorkRequest,
  type SettleRequest,
  type SubmitRequest,
  type SubmitResultRequest,
} from "@/lib/api-contracts"

export type ApiClientResult<TEndpoint extends ApiEndpoint> = {
  response: ApiResponse<unknown, ApiRequestByEndpoint[TEndpoint]>
  status: number
  latencyMs: number
}

async function request<TEndpoint extends ApiEndpoint>(
  endpoint: TEndpoint,
  init?: {
    method?: "GET" | "POST"
    body?: ApiRequestByEndpoint[TEndpoint]
  },
): Promise<ApiClientResult<TEndpoint>> {
  const startedAt = performance.now()
  const method = init?.method ?? "GET"
  const httpResponse = await fetch(API_PATHS[endpoint], {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(init?.body) : undefined,
  })
  const latencyMs = Math.round(performance.now() - startedAt)
  const response = (await httpResponse.json()) as ApiResponse<unknown, ApiRequestByEndpoint[TEndpoint]>

  return {
    response,
    status: httpResponse.status,
    latencyMs,
  }
}

export function getHealth() {
  return request("health")
}

export function submitJob(body: SubmitRequest) {
  return request("submit", { method: "POST", body })
}

export function pullWork(body: PullWorkRequest) {
  return request("pull-work", { method: "POST", body })
}

export function submitResult(body: SubmitResultRequest) {
  return request("submit-result", { method: "POST", body })
}

export function settle(body: SettleRequest) {
  return request("settle", { method: "POST", body })
}

export function parseJob(body: ParseJobRequest) {
  return request("jobs/parse", { method: "POST", body })
}
