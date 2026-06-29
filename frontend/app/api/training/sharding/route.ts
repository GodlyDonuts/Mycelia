import { NextResponse } from "next/server"
import { assignShards, coefficientOfVariation } from "@/lib/training/heterogeneity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const nodes = [
    { nodeId: "n1", tokensPerSec: 1200, vramGb: 24, reliability: 0.98 },
    { nodeId: "n2", tokensPerSec: 800, vramGb: 12, reliability: 0.95 },
    { nodeId: "n3", tokensPerSec: 400, vramGb: 8, reliability: 0.88 },
    { nodeId: "n4", tokensPerSec: 200, vramGb: 6, reliability: 0.92 },
  ]
  const shards = assignShards(nodes, 10000)
  const cv = coefficientOfVariation(nodes.map((n) => n.tokensPerSec))
  return NextResponse.json({
    totalSamples: 10000,
    assignments: shards,
    throughputCv: cv,
    rebalanceRecommended: cv > 0.4,
    note: "Heterogeneity-aware shard sizing — faster nodes train on larger data slices.",
  })
}
