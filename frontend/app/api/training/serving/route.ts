import { NextResponse } from "next/server"
import { initModel, serve, monolithic } from "@/lib/training/pipeline"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Pipeline-parallel inference serving (docs/ML_LAYER.md §10 "distributed inference
// serving"): forward a batch across pipeline stages (activations cross the wire).
// Output equals a monolithic forward — the same correctness property as training.
export async function GET() {
  const model = initModel(11)
  const n = 256
  const t0 = performance.now()
  let maxDiff = 0
  const outputs: number[] = []
  for (let i = 0; i < n; i++) {
    const z = Array.from({ length: 8 }, (_, j) => Math.sin(i * 0.31 + j))
    const y = serve(model, z) // pipeline forward across 2 stages
    outputs.push(y)
    maxDiff = Math.max(maxDiff, Math.abs(y - monolithic(model, z, 0).y))
  }
  const ms = performance.now() - t0
  return NextResponse.json({
    served: n,
    stages: 2,
    throughputPerSec: Math.round(n / (ms / 1000)),
    equivalentToMonolithic: maxDiff < 1e-9,
    sample: outputs.slice(0, 3).map((y) => Math.round(y * 1000) / 1000),
    note: "Pipeline-parallel serving; production stages are separate nodes over the wire. Large-model serving = same mechanism at scale (roadmap).",
  })
}
