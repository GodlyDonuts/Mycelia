import { readJsonBody, stubJson } from "@/lib/api-stub"

export async function POST(request: Request) {
  const received = await readJsonBody(request)

  return stubJson("pull-work", "pull-work endpoint reachable", received)
}
