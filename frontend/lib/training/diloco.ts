// DiLoCo outer optimizer (docs/ML_LAYER.md §4 — infrequent sync across cells).
// Cells run H local steps; the coordinator applies an outer Nesterov step on the
// pseudo-gradient formed from capability-weighted adapter deltas.

export interface CellDelta {
  cellId: string
  delta: number[]
  capability: number // FLOPs-equivalent weight
  localSteps: number
}

export interface DiLoCoConfig {
  H: number // local steps between syncs
  outerLr: number
  outerMomentum: number
  nesterov: boolean
}

export const DEFAULT_DILOCO: DiLoCoConfig = {
  H: 100,
  outerLr: 0.7,
  outerMomentum: 0.9,
  nesterov: true,
}

let outerVelocity: number[] | null = null

export function resetOuterState(): void {
  outerVelocity = null
}

/** Capability-weighted average of cell deltas. */
export function aggregateDeltas(cells: CellDelta[]): number[] {
  if (cells.length === 0) return []
  const dim = cells[0].delta.length
  const out = new Array(dim).fill(0)
  let wSum = 0
  for (const c of cells) {
    wSum += c.capability
    for (let i = 0; i < dim; i++) out[i] += c.delta[i] * c.capability
  }
  if (wSum === 0) return out
  return out.map((v) => v / wSum)
}

/** Outer Nesterov-style update on global adapter θ. */
export function outerStep(theta: number[], pseudoGrad: number[], cfg: DiLoCoConfig = DEFAULT_DILOCO): number[] {
  if (!outerVelocity || outerVelocity.length !== theta.length) {
    outerVelocity = new Array(theta.length).fill(0)
  }
  const v = outerVelocity
  for (let i = 0; i < theta.length; i++) {
    v[i] = cfg.outerMomentum * v[i] + pseudoGrad[i]
    const step = cfg.nesterov ? cfg.outerMomentum * v[i] + pseudoGrad[i] : v[i]
    theta[i] -= cfg.outerLr * step
  }
  return theta
}

export function syncIntervalEstimate(localStepsPerSec: number, H: number): number {
  return H / Math.max(localStepsPerSec, 0.01)
}
