import { errorJson, readJsonBody, successJson } from "@/lib/api-stub"
import { getSubmitResultRequestErrors } from "@/lib/api-validation"

export async function POST(request: Request) {
  const received = await readJsonBody<unknown>(request)
  const errors = getSubmitResultRequestErrors(received)

  if (errors.length) {
    return errorJson("submit-result", "Invalid submit-result request", errors)
  }

  return successJson({
    endpoint: "submit-result",
    message: "submit-result endpoint reachable",
    data: { accepted: true },
    received,
  })
}
