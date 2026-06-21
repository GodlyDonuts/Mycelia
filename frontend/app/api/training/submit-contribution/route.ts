import { NextResponse } from "next/server"
import { submitContribution } from "@/lib/training/coordinator"
import { TrainingContribBody } from "@/lib/contracts"
import { badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const parsed = TrainingContribBody.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("cellId, roundId, jobId, nodeId, localTheta[] required")
  try {
    const b = parsed.data
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
    return badRequest(err)
  }
}
