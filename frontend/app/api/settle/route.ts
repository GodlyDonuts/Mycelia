import { NextResponse } from "next/server"
import { settle } from "@/lib/coordinator"
import { SettleBody } from "@/lib/contracts"
import { badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Server-authoritative settlement (PLAN.md §3). A client may request it; the
// server re-verifies all-tiles-verified before finalizing.
export async function POST(req: Request) {
  const parsed = SettleBody.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("jobId required")
  try {
    const out = await settle(parsed.data.jobId)
    return NextResponse.json({ ok: true, ...out })
  } catch (err) {
    return badRequest(err)
  }
}
