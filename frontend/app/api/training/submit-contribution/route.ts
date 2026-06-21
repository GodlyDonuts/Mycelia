import { NextResponse } from "next/server"
import { submitContribution } from "@/lib/training/coordinator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const b = await req.json()
    if (!b.cellId || !b.roundId || !b.jobId || !b.nodeId || !Array.isArray(b.localTheta)) {
      return NextResponse.json({ ok: false, error: "cellId, roundId, jobId, nodeId, localTheta required" }, { status: 400 })
    }
    const out = await submitContribution({
      cellId: b.cellId,
      roundId: b.roundId,
      jobId: b.jobId,
      nodeId: b.nodeId,
      nodeName: b.nodeName ?? "external-worker",
      localTheta: b.localTheta,
      tokens: b.tokens ?? b.localTheta.length,
      localSteps: b.localSteps ?? 0,
    })
    return NextResponse.json(out)
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "error" }, { status: 400 })
  }
}
