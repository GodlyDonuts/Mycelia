import { NextResponse } from "next/server"
import { settle } from "@/lib/coordinator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Server-authoritative settlement (PLAN.md §3). A client may request it; the
// server re-verifies all-tiles-verified before finalizing.
export async function POST(req: Request) {
  try {
    const { jobId } = await req.json()
    if (!jobId) return NextResponse.json({ ok: false, error: "jobId required" }, { status: 400 })
    const out = await settle(jobId)
    return NextResponse.json({ ok: true, ...out })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "error" }, { status: 400 })
  }
}
