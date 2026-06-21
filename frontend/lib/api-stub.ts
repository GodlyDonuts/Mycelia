import { NextResponse } from "next/server"
import type { ApiEndpoint, ApiErrorResponse, ApiSuccessResponse } from "@/lib/api-contracts"

export function successJson<TData = unknown, TReceived = unknown>({
  endpoint,
  message,
  data,
  received,
}: {
  endpoint: ApiEndpoint
  message: string
  data?: TData
  received?: TReceived
}) {
  const body: ApiSuccessResponse<TData, TReceived> = {
    ok: true,
    endpoint,
    message,
    timestamp: new Date().toISOString(),
  }

  if (data !== undefined) {
    body.data = data
  }

  if (received !== undefined) {
    body.received = received
  }

  return NextResponse.json(body)
}

export function errorJson(endpoint: ApiEndpoint, error: string, details?: string[], status = 400) {
  const body: ApiErrorResponse = {
    ok: false,
    endpoint,
    error,
    timestamp: new Date().toISOString(),
  }

  if (details?.length) {
    body.details = details
  }

  return NextResponse.json(body, { status })
}

export async function readJsonBody<TBody>(request: Request) {
  return request.json().catch(() => null) as Promise<TBody | null>
}
