import { readJsonBody, stubJson } from "@/lib/api-stub"
import type { ParseJobRequest } from "@/lib/api-contracts"

export async function POST(request: Request) {
  const received = await readJsonBody<ParseJobRequest>(request)

  return stubJson("jobs/parse", "jobs/parse endpoint reachable", received)
}
