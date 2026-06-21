import { NextResponse } from "next/server"
import { submitTrainingJob } from "@/lib/training/coordinator"
import { TrainingSubmitBody } from "@/lib/contracts"
import { rateLimit, clientId, tooMany, badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const rl = rateLimit(`tsubmit:${clientId(req)}`, 10, 60_000)
  if (!rl.ok) return tooMany(rl.retryAfter)
  const parsed = TrainingSubmitBody.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("invalid training job spec")
  try {
    const out = await submitTrainingJob(parsed.data)
    return NextResponse.json({ ok: true, ...out })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error"
    return msg === "INSUFFICIENT_FUNDS"
      ? NextResponse.json({ ok: false, error: msg }, { status: 402 })
      : badRequest(err)
  }
}
