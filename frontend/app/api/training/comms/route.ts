import { NextResponse } from "next/server"
import { denseBytes } from "@/lib/training/compress"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Communication budget for the training outer loop (ML_LAYER §5): how small the
// shipped adapter delta gets with top-k + int8 + error feedback. The byte math
// matches lib/training/compress.ts (packed = k×2 index + k int8 + 4 scale);
// convergence-under-compression is verified by the unit suite.
function metrics(label: string, dim: number, frac: number) {
  const k = Math.max(1, Math.ceil(dim * frac))
  const dense = denseBytes(dim)
  const packed = k * 3 + 4
  return { label, dim, k, denseBytes: dense, packedBytes: packed, ratio: Math.round(dense / packed) }
}

export async function GET() {
  return NextResponse.json({
    method: "top-k + int8 + error feedback (DeMo/DisTrO lineage)",
    convergence: "preserved (residual fed back each round)",
    adapters: [
      metrics("demo adapter", 16, 0.5),
      metrics("LoRA r16 · 0.5B (q,v proj)", 1_114_112, 0.02),
    ],
  })
}
