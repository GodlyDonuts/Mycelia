import { describe, it, expect } from "vitest"
import { matmul, columnParallel, rowParallel, maxAbsDiff, type Matrix } from "@/lib/training/tensor"

function rand(m: number, n: number, seed: number): Matrix {
  let a = seed >>> 0
  const r = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
  }
  return Array.from({ length: m }, () => Array.from({ length: n }, r))
}

describe("tensor parallelism", () => {
  const X = rand(5, 8, 1)
  const W = rand(8, 6, 2)
  const ref = matmul(X, W)

  it("column-parallel equals single-node matmul (any shard count)", () => {
    for (const s of [1, 2, 3, 6]) expect(maxAbsDiff(columnParallel(X, W, s), ref)).toBeLessThan(1e-12)
  })

  it("row-parallel (all-reduce) equals single-node matmul (any shard count)", () => {
    for (const s of [1, 2, 4, 8]) expect(maxAbsDiff(rowParallel(X, W, s), ref)).toBeLessThan(1e-12)
  })

  it("handles uneven splits correctly", () => {
    expect(maxAbsDiff(columnParallel(X, W, 4), ref)).toBeLessThan(1e-12) // 6 cols / 4 shards
    expect(maxAbsDiff(rowParallel(X, W, 3), ref)).toBeLessThan(1e-12) // 8 rows / 3 shards
  })

  it("output shape is preserved", () => {
    const y = columnParallel(X, W, 2)
    expect(y.length).toBe(5)
    expect(y[0].length).toBe(6)
  })
})
