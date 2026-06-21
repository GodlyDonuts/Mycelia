// Batched inference as a verifiable workload class (PLAN §1 target workloads;
// Phase 6). A fixed model is applied to a seeded batch of inputs → a sequence of
// predictions whose checksum is deterministic, so the result is bitwise-
// verifiable by reseeded recompute — same escrow-until-verified settlement.
// (Real LLM inference is FP-nondeterministic across hardware and uses
// homogeneous-redundancy/trusted spot-checks; this deterministic classifier is
// the buildable, verifiable stand-in.)

const FEAT = 12
const CLASSES = 4
const MODEL_SEED = 0x1a2b3c

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function gauss(r: () => number) {
  let u = 0, v = 0
  while (u === 0) u = r()
  while (v === 0) v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// fixed model weights (CLASSES × FEAT) — the "deployed model"
const MODEL: number[][] = (() => {
  const r = mulberry32(MODEL_SEED)
  return Array.from({ length: CLASSES }, () => Array.from({ length: FEAT }, () => gauss(r)))
})()

export interface InferResult {
  seed: number
  n: number
  checksum: string
  classCounts: number[]
}

/** Classify a seeded batch of n inputs; return a deterministic checksum + class histogram. */
export function inferBatch(seed: number, n: number): InferResult {
  const r = mulberry32(seed)
  const counts = new Array(CLASSES).fill(0)
  let h = 0x811c9dc5
  for (let i = 0; i < n; i++) {
    const x = Array.from({ length: FEAT }, () => gauss(r))
    let best = 0
    let bestScore = -Infinity
    for (let c = 0; c < CLASSES; c++) {
      let s = 0
      for (let f = 0; f < FEAT; f++) s += MODEL[c][f] * x[f]
      if (s > bestScore) { bestScore = s; best = c }
    }
    counts[best]++
    h ^= best + 1
    h = Math.imul(h, 0x01000193)
  }
  return { seed, n, checksum: (h >>> 0).toString(16).padStart(8, "0"), classCounts: counts }
}

/** Deterministic verify: recompute the batch and require an exact checksum match. */
export function verifyInference(seed: number, n: number, checksum: string): boolean {
  return inferBatch(seed, n).checksum === checksum
}

export function aggregateInference(batches: InferResult[]): { throughput: number; classDist: number[] } {
  const throughput = batches.reduce((s, b) => s + b.n, 0)
  const classDist = new Array(CLASSES).fill(0)
  for (const b of batches) for (let c = 0; c < CLASSES; c++) classDist[c] += b.classCounts[c]
  return { throughput, classDist }
}
