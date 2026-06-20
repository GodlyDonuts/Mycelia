import { NextResponse } from "next/server"

export type StubResponse = {
  ok: true
  endpoint: string
  message: string
  received?: unknown
  timestamp: string
}

export function stubJson(endpoint: string, message: string, received?: unknown) {
  const body: StubResponse = {
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

export async function readJsonBody(request: Request) {
  return request.json().catch(() => null)
}
