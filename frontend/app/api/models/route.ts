import { NextResponse } from "next/server"
import { MODEL_REGISTRY, loraParamCount } from "@/lib/models/registry"
import { LLAMA_7B_SHARDS, paramsPerShard } from "@/lib/models/megatron-layers"
import { QLORA_POLICY, adapterMemoryBytes } from "@/lib/training/mixed-precision"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const model = MODEL_REGISTRY[1]
  const rank = 16
  const loraDim = loraParamCount(4096, rank, model.loraTargets.length)
  return NextResponse.json({
    registry: MODEL_REGISTRY.map((m) => ({ id: m.id, paramsB: m.paramsB, status: m.status })),
    featured: model.id,
    lora: {
      rank,
      trainableParams: loraDim,
      memoryBytes: adapterMemoryBytes(loraDim, QLORA_POLICY),
      policy: QLORA_POLICY,
    },
    tensorParallel: LLAMA_7B_SHARDS.slice(0, 4).map((s) => ({
      layer: s.name,
      paramsPerShard: paramsPerShard(s),
    })),
    note: "Model registry + sharding specs for Regime-1 (single-GPU) and Regime-2 (TP/PP) cells.",
  })
}
