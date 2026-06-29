import { NextResponse } from "next/server"
import { exportPrometheus, recordMetrics, latestMetrics } from "@/lib/observability/training-metrics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get("format") === "prometheus") {
    recordMetrics({
      round: 42,
      activeCells: 8,
      avgLoss: 1.82,
      bytesShipped: 1_114_112,
      p2pSessions: 6,
      zkProofsVerified: 0,
    })
    return new NextResponse(exportPrometheus(), {
      headers: { "content-type": "text/plain; version=0.0.4" },
    })
  }
  recordMetrics({
    round: 42,
    activeCells: 8,
    avgLoss: 1.82,
    bytesShipped: 1_114_112,
    p2pSessions: 6,
    zkProofsVerified: 0,
  })
  return NextResponse.json({
    metrics: latestMetrics(),
    note: "OTel/Prometheus export for training coordinator observability.",
  })
}
