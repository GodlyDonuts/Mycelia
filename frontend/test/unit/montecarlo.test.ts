import { describe, it, expect } from "vitest"
import { estimatePi, verifyMonteCarlo, aggregatePi } from "@/lib/montecarlo"

describe("Monte Carlo workload", () => {
  it("is deterministic for a given seed", () => {
    const a = estimatePi(123, 10_000)
    const b = estimatePi(123, 10_000)
    expect(a.inside).toBe(b.inside)
    expect(a.pi).toBe(b.pi)
  })

  it("estimates π within a reasonable tolerance for enough samples", () => {
    const { pi } = estimatePi(42, 200_000)
    expect(Math.abs(pi - Math.PI)).toBeLessThan(0.05)
  })

  it("verify accepts an honest result and rejects a tampered count", () => {
    const r = estimatePi(7, 5000)
    expect(verifyMonteCarlo(7, 5000, r.inside)).toBe(true)
    expect(verifyMonteCarlo(7, 5000, r.inside + 1)).toBe(false)
  })

  it("aggregating many tasks converges closer to π", () => {
    const tasks = Array.from({ length: 20 }, (_, i) => estimatePi(1000 + i, 50_000))
    const agg = aggregatePi(tasks)
    expect(agg.samples).toBe(20 * 50_000)
    expect(agg.error).toBeLessThan(0.02)
  })
})
