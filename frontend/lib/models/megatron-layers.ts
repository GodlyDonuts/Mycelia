// Megatron-style tensor-parallel layer definitions (reference shapes for roadmap).
// Maps transformer block → shard layout for q/k/v/o and MLP columns.

export interface LayerShardSpec {
  name: string
  totalParams: number
  shardAxis: "column" | "row" | "none"
  shardCount: number
  activationCrossWire: boolean
}

export function llamaBlockShards(hidden: number, ffn: number, heads: number, tp: number): LayerShardSpec[] {
  return [
    { name: "q_proj", totalParams: hidden * hidden, shardAxis: "column", shardCount: tp, activationCrossWire: true },
    { name: "k_proj", totalParams: hidden * hidden, shardAxis: "column", shardCount: tp, activationCrossWire: true },
    { name: "v_proj", totalParams: hidden * hidden, shardAxis: "column", shardCount: tp, activationCrossWire: true },
    { name: "o_proj", totalParams: hidden * hidden, shardAxis: "row", shardCount: tp, activationCrossWire: true },
    { name: "gate_proj", totalParams: hidden * ffn, shardAxis: "column", shardCount: tp, activationCrossWire: true },
    { name: "up_proj", totalParams: hidden * ffn, shardAxis: "column", shardCount: tp, activationCrossWire: true },
    { name: "down_proj", totalParams: ffn * hidden, shardAxis: "row", shardCount: tp, activationCrossWire: true },
  ]
}

export function paramsPerShard(spec: LayerShardSpec): number {
  if (spec.shardAxis === "none") return spec.totalParams
  return Math.ceil(spec.totalParams / spec.shardCount)
}

export function wireActivationsPerLayer(block: LayerShardSpec[]): number {
  return block.filter((l) => l.activationCrossWire).length
}

export const LLAMA_7B_SHARDS = llamaBlockShards(4096, 11008, 32, 4)
export const LLAMA_70B_SHARDS = llamaBlockShards(8192, 28672, 64, 8)
