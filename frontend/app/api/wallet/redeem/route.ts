import { NextResponse } from "next/server"
import { z } from "zod"
import { requestRedemption, REDEEM_METHODS } from "@/lib/wallet"
import { rateLimit, clientId, tooMany, badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Body = z.object({ amount: z.number().positive().max(1_000_000), method: z.enum(REDEEM_METHODS) })

export async function POST(req: Request) {
  const rl = rateLimit(`redeem:${clientId(req)}`, 10, 60_000)
  if (!rl.ok) return tooMany(rl.retryAfter)
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("amount + method required")
  try {
    const out = await requestRedemption(parsed.data.amount, parsed.data.method)
    return NextResponse.json({ ok: true, ...out })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error"
    const status = msg === "INSUFFICIENT_BALANCE" ? 402 : 400
    return NextResponse.json({ ok: false, error: msg }, { status })
  }
}
