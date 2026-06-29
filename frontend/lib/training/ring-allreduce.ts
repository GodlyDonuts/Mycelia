// Ring all-reduce for intra-cell gradient sync (Megatron/DeepSpeed lineage).
// Used when a cell has multiple nodes holding tensor-parallel shards and must
// merge partial gradients before the outer DiLoCo step. In-process proof only.

export interface RingShard {
  nodeIndex: number
  ringSize: number
  chunk: number[]
}

export function splitVector(vec: number[], ringSize: number): number[][] {
  const chunkLen = Math.ceil(vec.length / ringSize)
  return Array.from({ length: ringSize }, (_, i) =>
    vec.slice(i * chunkLen, (i + 1) * chunkLen),
  )
}

/** One ring-reduce step: scatter-reduce then all-gather (simplified 2-phase). */
export function ringReduce(shards: RingShard[]): number[] {
  const n = shards[0]?.ringSize ?? 0
  if (n === 0) return []
  const acc = new Array(shards[0].chunk.length * n).fill(0)
  for (const s of shards) {
    const offset = s.nodeIndex * s.chunk.length
    for (let i = 0; i < s.chunk.length; i++) acc[offset + i] += s.chunk[i]
  }
  return acc
}

export function ringSteps(ringSize: number): number {
  return 2 * (ringSize - 1)
}

export function bytesPerStep(chunkBytes: number, ringSize: number): number {
  return chunkBytes * ringSteps(ringSize)
}
