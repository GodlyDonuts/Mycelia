import { NextResponse } from "next/server"
import { registerNode } from "@/lib/coordinator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const out = await registerNode({
      id: body.id,
      name: body.name ?? `browser-${Math.random().toString(36).slice(2, 7)}`,
      kind: body.kind ?? "browser",
      gpuModel: body.gpuModel ?? "—",
      isSimulated: false,
      region: body.region ?? "browser",
    })
    return NextResponse.json({ ok: true, ...out })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "error" }, { status: 400 })
  }
}
