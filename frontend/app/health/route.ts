import { successJson } from "@/lib/api-stub"

export async function GET() {
  return successJson({
    endpoint: "health",
    message: "health endpoint reachable",
    data: { status: "ok" },
  })
}
