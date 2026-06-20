import { readJsonBody, stubJson } from "@/lib/api-stub"
import type { SubmitResultRequest } from "@/lib/api-contracts"

export async function POST(request: Request) {
  const received = await readJsonBody<SubmitResultRequest>(request)

  return stubJson("submit-result", "submit-result endpoint reachable", received)
}
