// Heterogeneity-aware data shard assignment (docs/ML_LAYER.md §6).
// Faster nodes receive larger shards proportional to measured throughput.

export interface NodeCapability {
  nodeId: string
  tokensPerSec: number
  vramGb: number
  reliability: number // 0–1
}

export interface ShardAssignment {
  nodeId: string
  shardIndex: number
  sampleCount: number
  weight: number
}

export function assignShards(nodes: NodeCapability[], totalSamples: number): ShardAssignment[] {
  const scores = nodes.map((n) => n.tokensPerSec * n.reliability)
  const sum = scores.reduce((a, b) => a + b, 0) || 1
  let allocated = 0
  const out: ShardAssignment[] = nodes.map((n, i) => {
    const weight = scores[i] / sum
    const count = i === nodes.length - 1 ? totalSamples - allocated : Math.floor(totalSamples * weight)
    allocated += count
    return { nodeId: n.nodeId, shardIndex: i, sampleCount: count, weight }
  })
  return out
}

export function rebalanceTrigger(cv: number, threshold = 0.4): boolean {
  return cv > threshold
}

export function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean === 0) return 0
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) / mean
}
