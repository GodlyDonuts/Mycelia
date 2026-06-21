import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { submitJob } from "@/lib/coordinator"
import { JobSpecSchema } from "@/lib/jobspec"
import { rateLimit, clientId, tooMany } from "@/lib/http"
import { verifySession, canSubmit, accountForRole, SESSION_COOKIE } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const rl = rateLimit(`submit:${clientId(req)}`, 20, 60_000) // 20 submits / minute / IP
  if (!rl.ok) return tooMany(rl.retryAfter)
  // Role gating (PLAN §6): a signed-in Provider can't submit; anonymous = demo requester.
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (session && !canSubmit(session.role)) {
    return NextResponse.json({ ok: false, error: "PROVIDER_CANNOT_SUBMIT" }, { status: 403 })
  }
  try {
    const body = await req.json()
    // Re-validate against the same schema that guards the ledger (PLAN.md §6).
    const spec = JobSpecSchema.parse(body)
    const out = await submitJob(spec, { requesterId: session ? accountForRole(session.role) : undefined })
    return NextResponse.json({ ok: true, ...out })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad request"
    const status = msg === "INSUFFICIENT_FUNDS" ? 402 : 400
    return NextResponse.json({ ok: false, error: msg }, { status })
  }
}
