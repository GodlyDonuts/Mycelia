import { NextResponse } from "next/server"
import { registerNode } from "@/lib/coordinator"
import { RegisterBody } from "@/lib/contracts"
import { rateLimit, clientId, tooMany, badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const rl = rateLimit(`register:${clientId(req)}`, 30, 60_000)
  if (!rl.ok) return tooMany(rl.retryAfter)
  const parsed = RegisterBody.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("invalid node registration")
  try {
    const b = parsed.data
    const out = await registerNode({
      id: b.id,
      name: b.name ?? `browser-${Math.random().toString(36).slice(2, 7)}`,
      kind: b.kind ?? "browser",
      gpuModel: b.gpuModel ?? "—",
      isSimulated: false,
      region: b.region ?? "browser",
    })
    return NextResponse.json({ ok: true, ...out })
  } catch (err) {
    return badRequest(err)
  }
}
