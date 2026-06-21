import { NextResponse } from "next/server"
import { heartbeat } from "@/lib/coordinator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { nodeId, cpu, gpu, ram, job } = await req.json()
    if (!nodeId) return NextResponse.json({ ok: false, error: "nodeId required" }, { status: 400 })
    await heartbeat(nodeId, { cpu, gpu, ram, job })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "error" }, { status: 400 })
  }
}
