import { NextResponse } from "next/server"
import { proveTrainingStep, verifyProof, proofSizeBytes, hashAdapter } from "@/lib/zk/sp1-training"
import { GRAD_NORM_CIRCUIT, provingTimeEstimate } from "@/lib/zk/circuits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const witness = {
    round: 42,
    cellId: "cell-demo",
    adapterBefore: hashAdapter([0.1, 0.2, 0.3]),
    adapterAfter: hashAdapter([0.09, 0.19, 0.28]),
    localSteps: 100,
    seed: 1337,
    lossBefore: 2.41,
    lossAfter: 2.18,
  }
  const proof = proveTrainingStep(witness)
  return NextResponse.json({
    system: "SP1 zkVM (RISC-V guest)",
    witness: { round: witness.round, localSteps: witness.localSteps },
    proof: { vkey: proof.programVkey, sizeBytes: proofSizeBytes(proof), verified: verifyProof(proof) },
    researchCircuits: {
      gradNorm: GRAD_NORM_CIRCUIT.name,
      proveTimeMsA100: provingTimeEstimate(GRAD_NORM_CIRCUIT, "A100"),
    },
    note: "Roadmap: replace canary-loss spot-check with succinct zk attestation of local SGD.",
  })
}
