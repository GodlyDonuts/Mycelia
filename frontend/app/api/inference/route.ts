import { NextResponse } from "next/server"
import { inferBatch, verifyInference, aggregateInference, type InferResult } from "@/lib/inference"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Live distributed batched inference: fan out K batches across the mesh, inject
// one tampered result, reject it via reseed-recompute, aggregate the rest.
export async function GET() {
  const K = 12
  const perBatch = 4000
  const base = 0xbada55
  const tampered = 4

  const accepted: InferResult[] = []
  let rejected = 0
  for (let i = 0; i < K; i++) {
    const seed = base + i * 104729
    const r = inferBatch(seed, perBatch)
    const claimed = i === tampered ? "deadbeef" : r.checksum // node 4 forges its checksum
    if (verifyInference(seed, perBatch, claimed)) accepted.push(r)
    else rejected++
  }
  const agg = aggregateInference(accepted)
  return NextResponse.json({ throughput: agg.throughput, classDist: agg.classDist, batches: K, verified: accepted.length, rejected })
}
