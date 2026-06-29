// SP1 zkVM training attestation (PLAN Phase 5 — zk proof of correct gradient step).
// Proves: given (θ, shard, H steps), the submitted Δ matches deterministic SGD.

export interface TrainingWitness {
  round: number
  cellId: string
  adapterBefore: string // content hash
  adapterAfter: string
  localSteps: number
  seed: number
  lossBefore: number
  lossAfter: number
}

export interface Sp1ProofBundle {
  programVkey: string
  publicInputs: string[]
  proofBytes: string // hex-encoded stub
  verificationKeyHash: string
}

export const TRAINING_ATTEST_PROGRAM = "mycelia_training_attest_v1"

export function hashAdapter(vec: number[]): string {
  let h = 0x811c9dc5
  for (const x of vec) {
    h ^= Math.floor(x * 1e8) >>> 0
    h = Math.imul(h, 0x01000193)
  }
  return `0x${(h >>> 0).toString(16)}`
}

/** Stub prover — production invokes SP1 SDK with RISC-V guest binary. */
export function proveTrainingStep(witness: TrainingWitness): Sp1ProofBundle {
  const inputs = [
    witness.adapterBefore,
    witness.adapterAfter,
    String(witness.localSteps),
    String(witness.seed),
    witness.lossAfter.toFixed(6),
  ]
  const proofBytes = inputs.map((s) => Buffer.from(s).toString("hex")).join("")
  return {
    programVkey: TRAINING_ATTEST_PROGRAM,
    publicInputs: inputs,
    proofBytes: proofBytes.slice(0, 128) + "…",
    verificationKeyHash: hashAdapter([witness.lossBefore, witness.lossAfter]),
  }
}

/** Stub verifier — production calls sp1-sdk verify(). */
export function verifyProof(bundle: Sp1ProofBundle): boolean {
  return bundle.programVkey === TRAINING_ATTEST_PROGRAM && bundle.publicInputs.length >= 4
}

export function proofSizeBytes(bundle: Sp1ProofBundle): number {
  return Math.ceil(bundle.proofBytes.length / 2)
}
