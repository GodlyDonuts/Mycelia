import { describe, it, expect } from "vitest"
import { compress, decompress, compressWithFeedback, denseBytes, packedBytes } from "@/lib/training/compress"
import { initAdapter, genBatch, localTrain, validationBatch, loss, ADAPTER_DIM } from "@/lib/training/model"

describe("communication compression", () => {
  it("top-k keeps the largest-magnitude entries", () => {
    const v = [0.1, -5, 0.2, 3, -0.05]
    const p = compress(v, 2)
    expect(p.idx).toEqual([1, 3]) // -5 and 3 are largest by magnitude
  })

  it("packed payload is much smaller than dense for a large vector", () => {
    const v = Array.from({ length: 4096 }, (_, i) => Math.sin(i))
    const p = compress(v, 64)
    expect(packedBytes(p)).toBeLessThan(denseBytes(4096) / 50) // >50x smaller
  })

  it("error feedback makes the residual carry what compression dropped", () => {
    const v = [1, 0.9, 0.8, 0.7, 0.6, 0.5]
    const r0 = new Array(6).fill(0)
    const { packed, residual } = compressWithFeedback(v, r0, 2)
    // only 2 of 6 entries sent ⇒ residual holds the rest
    expect(decompress(packed).filter((x) => x !== 0).length).toBe(2)
    expect(residual.some((x) => Math.abs(x) > 0.1)).toBe(true)
  })

  it("DiLoCo converges under heavy compression thanks to error feedback", () => {
    const val = validationBatch()
    let global = initAdapter()
    const residuals = Array.from({ length: 5 }, () => initAdapter())
    const start = loss(global, val)
    for (let round = 0; round < 12; round++) {
      const deltas: number[][] = []
      for (let c = 0; c < 5; c++) {
        const local = localTrain(global, genBatch(3000 + round * 10 + c, 100), 30, 0.08)
        const delta = global.map((g, i) => g - local[i]) // pseudo-gradient
        const { packed, residual } = compressWithFeedback(delta, residuals[c], Math.ceil(ADAPTER_DIM / 2))
        residuals[c] = residual
        deltas.push(decompress(packed))
      }
      const mean = global.map((_, i) => deltas.reduce((s, d) => s + d[i], 0) / deltas.length)
      global = global.map((g, i) => g - mean[i]) // outer step (DiLoCo, lr=1 ≈ FedAvg)
    }
    const end = loss(global, val)
    expect(end).toBeLessThan(start * 0.2) // still converges despite 50% sparsity + int8
  })
})
