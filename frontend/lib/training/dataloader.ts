// Deterministic data loader for verifiable training shards.
// Same seed + shard index ⇒ identical sample order (required for refereed recompute).

export interface Sample {
  id: number
  input: number[]
  target: number
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
  }
}

export function shardSamples(
  total: number,
  shardIndex: number,
  shardCount: number,
  seed: number,
  dim = 8,
): Sample[] {
  const r = rng(seed + shardIndex * 9973)
  const count = Math.floor(total / shardCount) + (shardIndex < total % shardCount ? 1 : 0)
  return Array.from({ length: count }, (_, i) => ({
    id: shardIndex * 10000 + i,
    input: Array.from({ length: dim }, () => r()),
    target: r(),
  }))
}

export function batchIterator(samples: Sample[], batchSize: number): Generator<Sample[]> {
  for (let i = 0; i < samples.length; i += batchSize) {
    yield samples.slice(i, i + batchSize)
  }
}

export function shardHash(samples: Sample[]): string {
  let h = 0
  for (const s of samples) {
    h = (h * 31 + s.id) | 0
    h = (h * 31 + Math.floor(s.target * 1e6)) | 0
  }
  return (h >>> 0).toString(16)
}
