import { NextResponse } from "next/server"
import type { ApiEndpoint, ApiStubResponse } from "@/lib/api-contracts"

export function stubJson<TReceived>(endpoint: ApiEndpoint, message: string, received?: TReceived) {
  const body: ApiStubResponse<TReceived> = {
    ok: true,
    endpoint,
    message,
    timestamp: new Date().toISOString(),
  }

  if (received !== undefined) {
    body.received = received
  }

  return NextResponse.json(body)
}

export async function readJsonBody<TBody>(request: Request) {
  return request.json().catch(() => null) as Promise<TBody | null>
}
