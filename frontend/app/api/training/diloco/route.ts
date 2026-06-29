import { NextResponse } from "next/server"
import { DEFAULT_DILOCO, aggregateDeltas, outerStep, syncIntervalEstimate } from "@/lib/training/diloco"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const dim = 16
  const cells = [
    { cellId: "A", delta: Array.from({ length: dim }, (_, i) => 0.01 * (i + 1)), capability: 100, localSteps: 100 },
    { cellId: "B", delta: Array.from({ length: dim }, (_, i) => 0.008 * (i + 1)), capability: 60, localSteps: 100 },
    { cellId: "C", delta: Array.from({ length: dim }, (_, i) => 0.012 * (i + 1)), capability: 40, localSteps: 100 },
  ]
  const pseudo = aggregateDeltas(cells)
  const theta = new Array(dim).fill(0)
  outerStep(theta, pseudo, DEFAULT_DILOCO)
  return NextResponse.json({
    config: DEFAULT_DILOCO,
    cellCount: cells.length,
    syncIntervalSec: syncIntervalEstimate(2.5, DEFAULT_DILOCO.H),
    capabilityWeighted: true,
    note: "DiLoCo outer loop — cells run H local steps between rare WAN-friendly merges.",
  })
}
