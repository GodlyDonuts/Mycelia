import { describe, it, expect } from "vitest"
import { inferBatch, verifyInference, aggregateInference } from "@/lib/inference"

describe("batched inference workload", () => {
  it("is deterministic for a given seed", () => {
    const a = inferBatch(11, 2000)
    const b = inferBatch(11, 2000)
    expect(a.checksum).toBe(b.checksum)
    expect(a.classCounts).toEqual(b.classCounts)
  })

  it("verify accepts honest + rejects a forged checksum", () => {
    const r = inferBatch(99, 1500)
    expect(verifyInference(99, 1500, r.checksum)).toBe(true)
    expect(verifyInference(99, 1500, "deadbeef")).toBe(false)
  })

  it("class histogram sums to the batch size", () => {
    const r = inferBatch(5, 3000)
    expect(r.classCounts.reduce((s, c) => s + c, 0)).toBe(3000)
  })

  it("aggregates throughput across batches", () => {
    const batches = Array.from({ length: 8 }, (_, i) => inferBatch(1000 + i, 1000))
    const agg = aggregateInference(batches)
    expect(agg.throughput).toBe(8000)
    expect(agg.classDist.reduce((s, c) => s + c, 0)).toBe(8000)
  })
})
