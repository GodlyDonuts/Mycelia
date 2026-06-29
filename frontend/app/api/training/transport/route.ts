import { NextResponse } from "next/server"
import { buildEnvelope, activationWireBudget } from "@/lib/training/transport"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const hidden = 4096
  const batch = 4
  const env = buildEnvelope(1, 2, 0, hidden, batch, "us-east-1", "us-west-2")
  return NextResponse.json({
    protocol: "activation-v1 over WebRTC DataChannel",
    hiddenDim: hidden,
    microBatch: batch,
    wireBudgetBytes: activationWireBudget(hidden, batch, "f16"),
    sampleEnvelope: env,
    note: "Production stages exchange activations P2P; coordinator only handles signaling + fallback relay.",
  })
}
