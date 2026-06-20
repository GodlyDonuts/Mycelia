import { readJsonBody, stubJson } from "@/lib/api-stub"
import type { SubmitRequest } from "@/lib/api-contracts"

export async function POST(request: Request) {
  const received = await readJsonBody<SubmitRequest>(request)

  return stubJson("submit", "submit endpoint reachable", received)
}
