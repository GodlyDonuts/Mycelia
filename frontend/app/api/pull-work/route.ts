import { NextResponse } from "next/server"
import { pullWork } from "@/lib/coordinator"
import { PullWorkBody } from "@/lib/contracts"
import { badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const parsed = PullWorkBody.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("nodeId + nodeName required")
  try {
    const { nodeId, nodeName, jobId } = parsed.data
    const tile = await pullWork({ id: nodeId, name: nodeName }, jobId)
    return NextResponse.json({ ok: true, tile })
  } catch (err) {
    return badRequest(err)
  }
}
