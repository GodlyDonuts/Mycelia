// Distributed checkpoint manager — adapter snapshots + optimizer state shards.
// Production: write to S3 with content-addressed blobs; here: in-memory CAS.

export interface CheckpointMeta {
  id: string
  round: number
  cellCount: number
  adapterDim: number
  sha256: string
  bytes: number
  createdAt: number
}

export interface CheckpointBlob {
  meta: CheckpointMeta
  adapter: number[]
  outerVelocity?: number[]
}

const store = new Map<string, CheckpointBlob>()

export function resetCheckpointStore(): void {
  store.clear()
}

function simpleHash(data: number[]): string {
  let h = 2166136261
  for (const x of data) {
    const v = Math.floor(x * 1e6) >>> 0
    h ^= v
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

export function saveCheckpoint(round: number, adapter: number[], outerVelocity?: number[]): CheckpointMeta {
  const id = `ckpt-r${round}-${simpleHash(adapter)}`
  const bytes = adapter.length * 4 + (outerVelocity?.length ?? 0) * 4
  const meta: CheckpointMeta = {
    id,
    round,
    cellCount: 0,
    adapterDim: adapter.length,
    sha256: simpleHash(adapter),
    bytes,
    createdAt: Date.now(),
  }
  store.set(id, { meta, adapter: [...adapter], outerVelocity: outerVelocity ? [...outerVelocity] : undefined })
  return meta
}

export function loadCheckpoint(id: string): CheckpointBlob | null {
  return store.get(id) ?? null
}

export function listCheckpoints(limit = 20): CheckpointMeta[] {
  return [...store.values()]
    .map((b) => b.meta)
    .sort((a, b) => b.round - a.round)
    .slice(0, limit)
}

export function retentionPolicy(maxCheckpoints: number): number {
  const all = listCheckpoints(1000)
  if (all.length <= maxCheckpoints) return 0
  return all.length - maxCheckpoints
}
