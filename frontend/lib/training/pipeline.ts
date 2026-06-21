// Model-sharded cells via pipeline parallelism (docs/ML_LAYER.md §3 Regime 2 —
// "model bigger than one GPU"). A cell of p nodes splits the model into pipeline
// stages; micro-batches flow forward n1→np and gradients flow back, exchanging
// ACTIVATIONS peer-to-peer (the only part that needs node-to-node networking).
//
// Here: a 2-layer MLP (W1: H×D on stage 1, w2: H on stage 2). The forward
// activation `h` crosses the wire to stage 2; the activation-gradient `gH`
// crosses back to stage 1. The whole pipeline produces gradients IDENTICAL to a
// monolithic node — that equivalence is the correctness property of sharding.
// (In production the stages are separate nodes over WebRTC/relay; here they're
// functions, so it's verifiable in-process.)

export const D = 8 // input dim
export const H = 6 // hidden units

export interface Model {
  W1: number[][] // H x D  (stage 1)
  w2: number[] // H        (stage 2)
}
export interface Grads {
  gW1: number[][]
  gW2: number[]
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

export function initModel(seed: number): Model {
  const r = rng(seed)
  return {
    W1: Array.from({ length: H }, () => Array.from({ length: D }, () => r() * 0.5)),
    w2: Array.from({ length: H }, () => r() * 0.5),
  }
}

// ---- monolithic (single-node) forward + backward ---------------------------

export function monolithic(model: Model, z: number[], target: number): { y: number; loss: number; grads: Grads } {
  const pre = model.W1.map((row) => row.reduce((s, w, j) => s + w * z[j], 0))
  const h = pre.map(Math.tanh)
  const y = model.w2.reduce((s, w, i) => s + w * h[i], 0)
  const dy = 2 * (y - target)
  const gW2 = h.map((hi) => dy * hi)
  const gH = model.w2.map((w) => dy * w)
  const gPre = gH.map((g, i) => g * (1 - h[i] * h[i]))
  const gW1 = gPre.map((gp) => z.map((zj) => gp * zj))
  return { y, loss: (y - target) ** 2, grads: { gW1, gW2 } }
}

// ---- pipeline stages (activations cross the "wire" between them) ------------

/** Stage 1: holds W1. Forward → activation h (sent to stage 2). */
export function stage1Forward(W1: number[][], z: number[]): { h: number[] } {
  const h = W1.map((row) => Math.tanh(row.reduce((s, w, j) => s + w * z[j], 0)))
  return { h }
}
/** Stage 2: holds w2. Forward + backward on the received activation h → grad of h (sent back). */
export function stage2(w2: number[], h: number[], target: number): { y: number; loss: number; gW2: number[]; gH: number[] } {
  const y = w2.reduce((s, w, i) => s + w * h[i], 0)
  const dy = 2 * (y - target)
  return { y, loss: (y - target) ** 2, gW2: h.map((hi) => dy * hi), gH: w2.map((w) => dy * w) }
}
/** Stage 2 forward-only (serving): produce the output from the received activation. */
export function stage2Forward(w2: number[], h: number[]): number {
  return w2.reduce((s, w, i) => s + w * h[i], 0)
}

/** Pipeline-parallel inference serving: forward a sample across stages → output. */
export function serve(model: Model, z: number[]): number {
  const { h } = stage1Forward(model.W1, z) // ──activation──▶ stage 2
  return stage2Forward(model.w2, h)
}

/** Stage 1 backward: uses the received gH + its own activation to finish gW1. */
export function stage1Backward(z: number[], h: number[], gH: number[]): number[][] {
  const gPre = gH.map((g, i) => g * (1 - h[i] * h[i]))
  return gPre.map((gp) => z.map((zj) => gp * zj))
}

/** Run the full 2-stage pipeline for one sample → (y, loss, grads). */
export function pipeline(model: Model, z: number[], target: number): { y: number; loss: number; grads: Grads } {
  const { h } = stage1Forward(model.W1, z) // ──activation──▶ stage 2
  const s2 = stage2(model.w2, h, target) //   ◀──gH grad──── stage 2
  const gW1 = stage1Backward(z, h, s2.gH)
  return { y: s2.y, loss: s2.loss, grads: { gW1, gW2: s2.gW2 } }
}

export function applyGrads(model: Model, g: Grads, lr: number): Model {
  return {
    W1: model.W1.map((row, i) => row.map((w, j) => w - lr * g.gW1[i][j])),
    w2: model.w2.map((w, i) => w - lr * g.gW2[i]),
  }
}

/** Max abs difference between two gradient sets (for equivalence checks). */
export function gradDiff(a: Grads, b: Grads): number {
  let m = 0
  for (let i = 0; i < H; i++) {
    m = Math.max(m, Math.abs(a.gW2[i] - b.gW2[i]))
    for (let j = 0; j < D; j++) m = Math.max(m, Math.abs(a.gW1[i][j] - b.gW1[i][j]))
  }
  return m
}
