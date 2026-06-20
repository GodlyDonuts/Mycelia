import { readJsonBody, stubJson } from "@/lib/api-stub"

export async function POST(request: Request) {
  const received = await readJsonBody(request)

  return stubJson("jobs/parse", "jobs/parse endpoint reachable", received)
}
