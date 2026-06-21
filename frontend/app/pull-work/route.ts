import { errorJson, readJsonBody, successJson } from "@/lib/api-stub"
import { getPullWorkRequestErrors } from "@/lib/api-validation"

export async function POST(request: Request) {
  const received = await readJsonBody<unknown>(request)
  const errors = getPullWorkRequestErrors(received)

  if (errors.length) {
    return errorJson("pull-work", "Invalid pull-work request", errors)
  }

  return successJson({
    endpoint: "pull-work",
    message: "pull-work endpoint reachable",
    data: { workAvailable: false },
    received,
  })
}
