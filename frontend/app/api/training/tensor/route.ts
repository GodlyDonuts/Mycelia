import { NextResponse } from "next/server"
import { matmul, columnParallel, rowParallel, maxAbsDiff, type Matrix } from "@/lib/training/tensor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Proof that tensor-parallel sharding (column-split + row-split/all-reduce)
// equals a single-node matmul (docs/ML_LAYER.md §3). Returns the max diff (≈0).
export async function GET() {
  const rand = (m: number, n: number, seed: number): Matrix => {
    let a = seed >>> 0
    const r = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1 }
    return Array.from({ length: m }, () => Array.from({ length: n }, r))
  }
  const X = rand(6, 12, 3), W = rand(12, 8, 4)
  const ref = matmul(X, W)
  const colDiff = maxAbsDiff(columnParallel(X, W, 3), ref)
  const rowDiff = maxAbsDiff(rowParallel(X, W, 4), ref)
  return NextResponse.json({
    columnParallel: { shards: 3, maxDiff: colDiff },
    rowParallel: { shards: 4, maxDiff: rowDiff, reduce: "all-reduce sum" },
    equivalentToSingleNode: colDiff < 1e-9 && rowDiff < 1e-9,
    note: "Tensor-parallel is intra-LAN/intra-node only (bandwidth-brutal); correctness verified in-process.",
  })
}
