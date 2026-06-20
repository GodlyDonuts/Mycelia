import { errorJson, readJsonBody, successJson } from "@/lib/api-stub"
import { getSubmitRequestErrors } from "@/lib/api-validation"

export async function POST(request: Request) {
  const received = await readJsonBody<unknown>(request)
  const errors = getSubmitRequestErrors(received)

  if (errors.length) {
    return errorJson("submit", "Invalid submit request", errors)
  }

  return successJson({
    endpoint: "submit",
    message: "submit endpoint reachable",
    data: { accepted: true },
    received,
  })
}
