import { errorJson, readJsonBody, successJson } from "@/lib/api-stub"
import { getSettleRequestErrors } from "@/lib/api-validation"

export async function POST(request: Request) {
  const received = await readJsonBody<unknown>(request)
  const errors = getSettleRequestErrors(received)

  if (errors.length) {
    return errorJson("settle", "Invalid settle request", errors)
  }

  return successJson({
    endpoint: "settle",
    message: "settle endpoint reachable",
    data: { settlementRequested: true },
    received,
  })
}
