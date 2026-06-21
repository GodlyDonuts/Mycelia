// Refereed-delegation recompute (PLAN §8, Gensyn Verde / RepOps lineage).
//
// When two nodes disagree on a tile, a referee does NOT recompute the whole tile
// (the 2× replication tax). It treats the computation as a sequential trace —
// here a CUMULATIVE per-row rolling hash, so once two traces diverge they stay
// diverged (monotonic) — binary-searches to the FIRST divergent row, and
// recomputes only that one row to decide who is correct. Verification cost goes
// from O(rows) toward O(log rows) comparisons + a single row recompute.

import { type JobRenderParams, computeRow } from "./fractal"

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

/** Cumulative rolling FNV hash after each row → monotonic divergence. */
export function traceHashes(bytes: Uint8Array, tilePx: number): string[] {
  const out: string[] = []
  let h = FNV_OFFSET
  for (let r = 0; r < tilePx; r++) {
    const base = r * tilePx
    for (let x = 0; x < tilePx; x++) {
      h ^= bytes[base + x]
      h = Math.imul(h, FNV_PRIME)
    }
    out.push((h >>> 0).toString(16).padStart(8, "0"))
  }
  return out
}

function foldRow(prevAcc: number, row: Uint8Array): string {
  let h = prevAcc >>> 0
  for (let x = 0; x < row.length; x++) {
    h ^= row[x]
    h = Math.imul(h, FNV_PRIME)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

export interface Adjudication {
  agree: boolean
  divergentRow: number | null
  comparisons: number // binary-search steps (≈ log2 rows)
  rowsRecomputed: number // the referee's actual recompute cost
  totalRows: number // full-recompute cost we avoided
  winner: "A" | "B" | "neither" | null
  speedup: number // totalRows / rowsRecomputed
}

/**
 * Adjudicate two claimed tile results for the same (job, tile). Returns who is
 * correct and the cost of doing so — almost always 1 recomputed row.
 */
export function adjudicate(params: JobRenderParams, index: number, bytesA: Uint8Array, bytesB: Uint8Array): Adjudication {
  const n = params.tilePx
  const A = traceHashes(bytesA, n)
  const B = traceHashes(bytesB, n)

  if (A[n - 1] === B[n - 1]) {
    return { agree: true, divergentRow: null, comparisons: 1, rowsRecomputed: 0, totalRows: n, winner: null, speedup: Infinity }
  }

  // binary-search the first row where the cumulative traces diverge (monotonic)
  let lo = 0
  let hi = n - 1
  let comparisons = 0
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    comparisons++
    if (A[mid] !== B[mid]) hi = mid
    else lo = mid + 1
  }
  const divergentRow = lo

  // recompute ONLY that row, continuing from the agreed cumulative hash below it
  const prevAcc = divergentRow > 0 ? parseInt(A[divergentRow - 1], 16) : FNV_OFFSET
  const refHash = foldRow(prevAcc, computeRow(params, index, divergentRow))
  const winner = refHash === A[divergentRow] ? "A" : refHash === B[divergentRow] ? "B" : "neither"

  return { agree: false, divergentRow, comparisons, rowsRecomputed: 1, totalRows: n, winner, speedup: Math.round((n / 1) * 10) / 10 }
}
