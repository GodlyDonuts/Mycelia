// Distributed-training math core (docs/ML_LAYER.md §3, Regime 1).
//
// Real, dependency-free, deterministic. A *frozen base* (a fixed random feature
// projection) plus a *trainable low-rank adapter* (the weights we ship around) —
// the LoRA-spirit setup, shrunk to a tractable supervised task so it runs
// in-process and converges visibly. The OUTER loop (data-parallel + DiLoCo/
// FedAvg merge + canary verification) is exactly the real architecture; only the
// inner workload is small. Swapping in a Python PyTorch+PEFT worker means
// implementing the same pull/contribute contract — nothing here changes.

export const FEATURE_DIM = 24 // raw input dimension
export const ADAPTER_DIM = 16 // trainable adapter size (the few-MB thing, here a vector)

// ---- seeded RNG + gaussian -------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function gauss(rng: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ---- the frozen base + the ground-truth task -------------------------------
// A fixed random projection B: FEATURE_DIM -> ADAPTER_DIM is the "frozen base".
// The label is produced by a fixed teacher adapter wTrue acting on the projected
// features, so a trainable adapter can actually fit it.

const BASE_SEED = 0x9e3779b1
const TEACHER_SEED = 0x1234abcd

function buildBase(): number[][] {
  const r = mulberry32(BASE_SEED)
  const B: number[][] = []
  for (let i = 0; i < ADAPTER_DIM; i++) {
    const row: number[] = []
    for (let j = 0; j < FEATURE_DIM; j++) row.push(gauss(r) / Math.sqrt(FEATURE_DIM))
    B.push(row)
  }
  return B
}
const BASE = buildBase()

function buildTeacher(): number[] {
  const r = mulberry32(TEACHER_SEED)
  return Array.from({ length: ADAPTER_DIM }, () => gauss(r))
}
const TEACHER = buildTeacher()

/** Frozen base feature map: raw x (FEATURE_DIM) -> projected z (ADAPTER_DIM). */
function project(x: number[]): number[] {
  const z = new Array(ADAPTER_DIM).fill(0)
  for (let i = 0; i < ADAPTER_DIM; i++) {
    let s = 0
    for (let j = 0; j < FEATURE_DIM; j++) s += BASE[i][j] * x[j]
    z[i] = Math.tanh(s) // nonlinear frozen features
  }
  return z
}

export interface Batch {
  Z: number[][] // projected features (post-frozen-base)
  y: number[]
}

/** Deterministically generate a batch of projected (z, y) pairs for a seed. */
export function genBatch(seed: number, n: number): Batch {
  const r = mulberry32(seed)
  const Z: number[][] = []
  const y: number[] = []
  for (let k = 0; k < n; k++) {
    const x = Array.from({ length: FEATURE_DIM }, () => gauss(r))
    const z = project(x)
    let t = 0
    for (let i = 0; i < ADAPTER_DIM; i++) t += TEACHER[i] * z[i]
    y.push(t + gauss(r) * 0.05) // small label noise
    Z.push(z)
  }
  return { Z, y }
}

// ---- the trainable adapter (θ) --------------------------------------------
export type Adapter = number[]

export function initAdapter(): Adapter {
  return new Array(ADAPTER_DIM).fill(0)
}

function predict(theta: Adapter, z: number[]): number {
  let s = 0
  for (let i = 0; i < ADAPTER_DIM; i++) s += theta[i] * z[i]
  return s
}

/** Mean-squared-error loss of an adapter on a batch. */
export function loss(theta: Adapter, b: Batch): number {
  let s = 0
  for (let k = 0; k < b.Z.length; k++) {
    const e = predict(theta, b.Z[k]) - b.y[k]
    s += e * e
  }
  return s / Math.max(1, b.Z.length)
}

/** H steps of full-batch gradient descent on a shard → new local adapter. */
export function localTrain(theta0: Adapter, shard: Batch, steps: number, lr: number): Adapter {
  const theta = theta0.slice()
  const n = shard.Z.length
  for (let step = 0; step < steps; step++) {
    const g = new Array(ADAPTER_DIM).fill(0)
    for (let k = 0; k < n; k++) {
      const e = predict(theta, shard.Z[k]) - shard.y[k]
      const z = shard.Z[k]
      for (let i = 0; i < ADAPTER_DIM; i++) g[i] += (2 * e * z[i]) / n
    }
    for (let i = 0; i < ADAPTER_DIM; i++) theta[i] -= lr * g[i]
  }
  return theta
}

// ---- outer optimizers ------------------------------------------------------

/** Token-weighted FedAvg: weighted mean of the local adapters (ML_LAYER §3). */
export function fedAvg(locals: Array<{ theta: Adapter; tokens: number }>): Adapter {
  const total = locals.reduce((s, l) => s + Math.max(1, l.tokens), 0)
  const out = new Array(ADAPTER_DIM).fill(0)
  for (const l of locals) {
    const w = Math.max(1, l.tokens) / total
    for (let i = 0; i < ADAPTER_DIM; i++) out[i] += w * l.theta[i]
  }
  return out
}

/** DiLoCo outer step with Nesterov-ish momentum on the averaged pseudo-gradient. */
export function diLoCo(
  global: Adapter,
  locals: Array<{ theta: Adapter; tokens: number }>,
  momentum: Adapter,
  outerLr = 0.7,
  beta = 0.9,
): { next: Adapter; momentum: Adapter } {
  const total = locals.reduce((s, l) => s + Math.max(1, l.tokens), 0)
  const delta = new Array(ADAPTER_DIM).fill(0) // mean pseudo-gradient = mean(global - local)
  for (const l of locals) {
    const w = Math.max(1, l.tokens) / total
    for (let i = 0; i < ADAPTER_DIM; i++) delta[i] += w * (global[i] - l.theta[i])
  }
  const m = momentum.length === ADAPTER_DIM ? momentum.slice() : new Array(ADAPTER_DIM).fill(0)
  const next = global.slice()
  for (let i = 0; i < ADAPTER_DIM; i++) {
    m[i] = beta * m[i] + delta[i]
    next[i] = global[i] - outerLr * m[i]
  }
  return { next, momentum: m }
}

// ---- verification (ML_LAYER §7) -------------------------------------------

const CANARY_SEED = 0x5151aa
const VAL_SEED = 0x7e571111

export function canaryBatch(n = 64): Batch {
  return genBatch(CANARY_SEED, n)
}
export function validationBatch(n = 256): Batch {
  return genBatch(VAL_SEED, n)
}

/** Cosine similarity between two pseudo-gradient directions. */
export function cosine(a: Adapter, b: Adapter): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/**
 * Canary-loss contribution validation (ML_LAYER §7, demo-grade): does the
 * submitted local adapter actually REDUCE loss on a canary batch the
 * coordinator controls, vs. the current global? Plus a gradient-norm sanity
 * cap so absurd updates are rejected. Returns the loss improvement (positive =
 * good) and the accept decision.
 */
export function verifyContribution(
  global: Adapter,
  localTheta: Adapter,
  canary: Batch,
): { accepted: boolean; canaryLossDelta: number; reason: string } {
  // sanity: reject NaN / absurd magnitude
  let norm = 0
  for (const v of localTheta) {
    if (!Number.isFinite(v)) return { accepted: false, canaryLossDelta: 0, reason: "non-finite weights" }
    norm += v * v
  }
  norm = Math.sqrt(norm)
  if (norm > 50) return { accepted: false, canaryLossDelta: 0, reason: "gradient-norm too large" }

  const before = loss(global, canary)
  const after = loss(localTheta, canary)
  const improvement = before - after // positive ⇒ reduced loss
  // Accept genuine updates (improve, or hold within a relative tolerance of the
  // current global) and reject garbage/poisoned deltas that blow the canary up.
  // The tolerance scales with the current loss so it works early (loss huge) and
  // late (near-converged, where good updates barely move the needle).
  const tol = Math.max(0.02, 0.5 * before)
  const accepted = improvement > -tol
  return {
    accepted,
    canaryLossDelta: Math.round(improvement * 1e6) / 1e6,
    reason: accepted ? (improvement > 0 ? "reduced canary loss" : "within tolerance") : "canary loss regressed",
  }
}
