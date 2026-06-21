import { NextResponse } from "next/server"
import { pullWork } from "@/lib/coordinator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { nodeId, nodeName, jobId } = await req.json()
    if (!nodeId || !nodeName) return NextResponse.json({ ok: false, error: "nodeId+nodeName required" }, { status: 400 })
    const tile = await pullWork({ id: nodeId, name: nodeName }, jobId)
    return NextResponse.json({ ok: true, tile })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "error" }, { status: 400 })
  }
}
