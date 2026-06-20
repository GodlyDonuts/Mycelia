import { readJsonBody, stubJson } from "@/lib/api-stub"
import type { SettleRequest } from "@/lib/api-contracts"

export async function POST(request: Request) {
  const received = await readJsonBody<SettleRequest>(request)

  return stubJson("settle", "settle endpoint reachable", received)
}
