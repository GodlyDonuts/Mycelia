// A second verifiable workload class (PLAN §1 target workloads; Phase 6
// "generalize beyond the fractal hero"). Monte Carlo π estimation: each task
// throws N seeded darts at the unit square and counts hits inside the quarter
// circle. Because the RNG is seeded, the result is DETERMINISTIC and therefore
// bitwise-verifiable by reseeded recompute — the same escrow-until-verified
// settlement as render tiles, a different workload.

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface MonteCarloResult {
  seed: number
  samples: number
  inside: number
  pi: number
}

/** Run one Monte Carlo task: count darts inside the quarter circle. */
export function estimatePi(seed: number, samples: number): MonteCarloResult {
  const rng = mulberry32(seed)
  let inside = 0
  for (let i = 0; i < samples; i++) {
    const x = rng()
    const y = rng()
    if (x * x + y * y <= 1) inside++
  }
  return { seed, samples, inside, pi: (4 * inside) / samples }
}

/** Deterministic verify: recompute with the same seed and require an exact match. */
export function verifyMonteCarlo(seed: number, samples: number, claimedInside: number): boolean {
  return estimatePi(seed, samples).inside === claimedInside
}

/** Aggregate accepted tasks into a single π estimate (sample-weighted). */
export function aggregatePi(tasks: MonteCarloResult[]): { pi: number; samples: number; error: number } {
  const samples = tasks.reduce((s, t) => s + t.samples, 0)
  const inside = tasks.reduce((s, t) => s + t.inside, 0)
  const pi = samples ? (4 * inside) / samples : 0
  return { pi, samples, error: Math.abs(pi - Math.PI) }
}
