import { NextResponse } from "next/server"
import { submitResult } from "@/lib/coordinator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { tileId, nodeId, nodeName, resultB64, gpuMs } = await req.json()
    if (!tileId || !nodeId || !resultB64) {
      return NextResponse.json({ ok: false, error: "tileId+nodeId+resultB64 required" }, { status: 400 })
    }
    const out = await submitResult({ tileId, nodeId, nodeName: nodeName ?? "browser-node", resultB64, gpuMs })
    return NextResponse.json(out)
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "error" }, { status: 400 })
  }
}
