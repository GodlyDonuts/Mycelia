import { NextResponse } from "next/server"
import { shardSamples, shardHash, batchIterator } from "@/lib/training/dataloader"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const samples = shardSamples(1000, 2, 8, 42)
  const batches = [...batchIterator(samples, 32)]
  return NextResponse.json({
    protocol: "deterministic shard iterator",
    shardIndex: 2,
    shardCount: 8,
    sampleCount: samples.length,
    shardHash: shardHash(samples),
    batchCount: batches.length,
    note: "Same seed + shard index yields identical samples — required for refereed recompute.",
  })
}
