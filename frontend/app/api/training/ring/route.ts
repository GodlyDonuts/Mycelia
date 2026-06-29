import { NextResponse } from "next/server"
import { splitVector, ringReduce, ringSteps, bytesPerStep } from "@/lib/training/ring-allreduce"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const vec = Array.from({ length: 32 }, (_, i) => Math.sin(i * 0.3))
  const ringSize = 4
  const chunks = splitVector(vec, ringSize)
  const shards = chunks.map((chunk, nodeIndex) => ({ nodeIndex, ringSize, chunk }))
  const reduced = ringReduce(shards)
  const maxErr = reduced.reduce((m, v, i) => Math.max(m, Math.abs(v - vec[i] * ringSize)), 0)
  return NextResponse.json({
    ringSize,
    steps: ringSteps(ringSize),
    bytesPerStep: bytesPerStep(vec.length * 4, ringSize),
    maxReconstructionErr: maxErr,
    note: "Intra-cell tensor-parallel gradient sync; production uses NCCL over LAN, ring over WAN fallback.",
  })
}
