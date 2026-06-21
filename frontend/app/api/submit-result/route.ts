import { NextResponse } from "next/server"
import { submitResult } from "@/lib/coordinator"
import { SubmitResultBody } from "@/lib/contracts"
import { badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const parsed = SubmitResultBody.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("tileId + nodeId + resultB64 required")
  try {
    const { tileId, nodeId, nodeName, resultB64, gpuMs } = parsed.data
    const out = await submitResult({ tileId, nodeId, nodeName: nodeName ?? "browser-node", resultB64, gpuMs })
    return NextResponse.json(out)
  } catch (err) {
    return badRequest(err)
  }
}
