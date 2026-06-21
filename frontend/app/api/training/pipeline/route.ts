import { NextResponse } from "next/server"
import { initModel, monolithic, pipeline, gradDiff } from "@/lib/training/pipeline"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Proof that model-sharded (pipeline-parallel) cells produce the same result as
// a monolithic node (docs/ML_LAYER.md §3 Regime 2). Stage 1 holds W1, stage 2
// holds w2; activations + activation-grads cross the wire. Returns the max grad
// difference (≈0) over several samples.
export async function GET() {
  const m = initModel(1)
  let maxDiff = 0
  for (let s = 0; s < 16; s++) {
    const z = Array.from({ length: 8 }, (_, j) => Math.sin(s * 1.7 + j))
    const mono = monolithic(m, z, Math.cos(s))
    const pipe = pipeline(m, z, Math.cos(s))
    maxDiff = Math.max(maxDiff, gradDiff(pipe.grads, mono.grads), Math.abs(pipe.y - mono.y))
  }
  return NextResponse.json({
    stages: 2,
    split: "W1 on stage 1, w2 on stage 2 (activations cross the wire)",
    maxGradDiff: maxDiff,
    equivalentToMonolithic: maxDiff < 1e-9,
    note: "Regime 2 model-sharded cells — production stages are separate nodes over WebRTC/relay; correctness verified in-process.",
  })
}
