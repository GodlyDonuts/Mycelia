import { describe, it, expect } from "vitest"
import { spotCheckRate, effReplication, sellableFraction, unitEconomics } from "@/lib/verification"

describe("verification economics", () => {
  it("spot-check rate falls as reputation rises (proven ~5%, unproven ~100%)", () => {
    expect(spotCheckRate(100)).toBeCloseTo(0.05, 5)
    expect(spotCheckRate(0)).toBeCloseTo(1, 5)
    expect(spotCheckRate(50)).toBeGreaterThan(spotCheckRate(90))
  })

  it("effective replication tax shrinks with reputation (2.0x → ~1.05x)", () => {
    expect(effReplication(0)).toBeCloseTo(2.0, 5)
    expect(effReplication(100)).toBeCloseTo(1.05, 5)
    expect(sellableFraction(100)).toBeGreaterThan(sellableFraction(0))
  })

  it("sellable fraction is the inverse of effective replication", () => {
    for (const rep of [0, 25, 60, 100]) {
      expect(sellableFraction(rep)).toBeCloseTo(1 / effReplication(rep), 9)
    }
  })

  it("unit economics reproduce the PLAN §7 regimes", () => {
    // proven (90% sellable) at cheap power is solidly positive
    const provenCheap = unitEconomics(0.12, 0.9)
    expect(provenCheap.net).toBeGreaterThan(0.05)
    // unproven (50% sellable) at high power is ~break-even
    const unprovenHigh = unitEconomics(0.3, 0.5)
    expect(Math.abs(unprovenHigh.net)).toBeLessThan(0.01)
    // platform fee is 20% of gross; provider receives the rest
    expect(provenCheap.fee).toBeCloseTo(provenCheap.gross * 0.2, 6)
    expect(provenCheap.receives).toBeCloseTo(provenCheap.gross - provenCheap.fee, 6)
  })

  it("net improves with a higher sellable fraction and cheaper power", () => {
    expect(unitEconomics(0.12, 0.9).net).toBeGreaterThan(unitEconomics(0.12, 0.5).net)
    expect(unitEconomics(0.12, 0.9).net).toBeGreaterThan(unitEconomics(0.3, 0.9).net)
  })
})
