import { NextResponse } from "next/server"
import { submitTrainingJob } from "@/lib/training/coordinator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const out = await submitTrainingJob(body)
    return NextResponse.json({ ok: true, ...out })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error"
    const status = msg === "INSUFFICIENT_FUNDS" ? 402 : 400
    return NextResponse.json({ ok: false, error: msg }, { status })
  }
}
