// Refereed-recompute + redundant-agreement verification for TRAINING
// contributions (docs/ML_LAYER.md §7). Two layers beyond the canary-loss check:
//
//  • refereed recompute: the referee re-runs a node's CLAIMED local SGD from the
//    same (global adapter, seed, data, steps, lr). Because localTrain is
//    deterministic, an honest delta matches exactly; a node that didn't actually
//    train (random delta) or that ran fewer steps (lazy) fails. Stake-weighted
//    spot-checks make cheating negative-EV.
//  • redundant directional agreement: assign a shard to two cells and accept if
//    their pseudo-gradients are directionally consistent (cosine ≥ threshold).

import { localTrain, genBatch, cosine, type Adapter } from "./model"

export interface ShardSpec {
  seed: number
  n: number
  steps: number
  lr: number
}

export interface RefereeVerdict {
  honest: boolean
  diff: number // max abs deviation from the recomputed adapter
  recomputedSteps: number
}

function maxAbsDiff(a: Adapter, b: Adapter): number {
  let d = 0
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - (b[i] ?? 0)))
  return d
}

/** Re-run the claimed local training and check the submitted adapter matches. */
export function refereeRecompute(global: Adapter, shard: ShardSpec, claimed: Adapter, tol = 1e-9): RefereeVerdict {
  const recomputed = localTrain(global, genBatch(shard.seed, shard.n), shard.steps, shard.lr)
  const diff = maxAbsDiff(claimed, recomputed)
  return { honest: diff <= tol, diff: Math.round(diff * 1e9) / 1e9, recomputedSteps: shard.steps }
}

/** Redundant-shard agreement: two cells on the same shard should agree in direction. */
export function directionalAgreement(global: Adapter, deltaA: Adapter, deltaB: Adapter, threshold = 0.9): { agree: boolean; cosine: number } {
  const dirA = global.map((g, i) => deltaA[i] - g)
  const dirB = global.map((g, i) => deltaB[i] - g)
  const c = Math.round(cosine(dirA, dirB) * 1000) / 1000
  return { agree: c >= threshold, cosine: c }
}
