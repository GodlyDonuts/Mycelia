import { NextResponse } from "next/server"
import { heartbeat } from "@/lib/coordinator"
import { HeartbeatBody } from "@/lib/contracts"
import { badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const parsed = HeartbeatBody.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("nodeId required")
  try {
    const { nodeId, cpu, gpu, ram, job } = parsed.data
    await heartbeat(nodeId, { cpu, gpu, ram, job })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return badRequest(err)
  }
}
