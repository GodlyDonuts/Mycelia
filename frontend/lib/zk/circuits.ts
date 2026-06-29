// Groth16-style circuit metadata for gradient-norm bounds (research track).
// Not on critical path — documents the zk roadmap beyond SP1 training attest.

export interface CircuitSpec {
  name: string
  constraints: number
  publicInputs: number
  privateInputs: number
  curve: "bn254" | "bls12-381"
}

export const GRAD_NORM_CIRCUIT: CircuitSpec = {
  name: "grad_norm_bound_v0",
  constraints: 2_048_000,
  publicInputs: 3,
  privateInputs: 4096,
  curve: "bn254",
}

export const ADAPTER_COMMIT_CIRCUIT: CircuitSpec = {
  name: "adapter_merkle_commit_v0",
  constraints: 512_000,
  publicInputs: 1,
  privateInputs: 8192,
  curve: "bn254",
}

export function provingTimeEstimate(spec: CircuitSpec, gpuTier: "A100" | "RTX4090" | "CPU"): number {
  const baseMs = spec.constraints / 5000
  const factor = gpuTier === "A100" ? 0.3 : gpuTier === "RTX4090" ? 0.5 : 4
  return Math.round(baseMs * factor)
}

export function verifyTimeMs(spec: CircuitSpec): number {
  return Math.round(spec.publicInputs * 0.8 + 12)
}
