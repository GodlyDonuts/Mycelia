import { stubJson } from "@/lib/api-stub"

export async function GET() {
  return stubJson("health", "health endpoint reachable")
}
