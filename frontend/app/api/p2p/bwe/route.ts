import { NextResponse } from "next/server"
import { recordSample, estimate, resetBwe } from "@/lib/p2p/bandwidth-estimator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  resetBwe()
  const now = Date.now()
  for (let i = 0; i < 10; i++) {
    recordSample({
      ts: now + i * 100,
      bytesSent: 65536 + i * 4096,
      rttMs: 28 + Math.sin(i) * 5,
      lossRate: 0.01 * (i % 3),
    })
  }
  const bwe = estimate()
  return NextResponse.json({
    algorithm: "send-side BWE + loss-aware dtype selection",
    estimate: bwe,
    note: "Adaptive activation compression on constrained home uplinks.",
  })
}
