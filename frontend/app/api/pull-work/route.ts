import { readJsonBody, stubJson } from "@/lib/api-stub"
import type { PullWorkRequest } from "@/lib/api-contracts"

export async function POST(request: Request) {
  const received = await readJsonBody<PullWorkRequest>(request)

  return stubJson("pull-work", "pull-work endpoint reachable", received)
}
