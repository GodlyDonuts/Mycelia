import { errorJson, readJsonBody, successJson } from "@/lib/api-stub"
import { getParseJobRequestDetails } from "@/lib/api-validation"

export async function POST(request: Request) {
  const received = await readJsonBody<unknown>(request)
  const errors = getParseJobRequestDetails(received)

  if (errors.length) {
    return errorJson("jobs/parse", "Invalid jobs/parse request", errors)
  }

  return successJson({
    endpoint: "jobs/parse",
    message: "jobs/parse endpoint reachable",
    data: { parsed: false },
    received,
  })
}
