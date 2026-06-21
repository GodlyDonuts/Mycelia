import { describe, it, expect } from "vitest"
import { REGIONS, isOffPeak, regionPayout } from "@/lib/regions"

const oslo = REGIONS.find((r) => r.name === "Oslo, NO")!
const berlin = REGIONS.find((r) => r.name === "Berlin, DE")!

describe("region-aware payouts", () => {
  it("off-peak window handles wrap past midnight", () => {
    expect(isOffPeak(berlin, 0)).toBe(true) // [23,5) wraps
    expect(isOffPeak(berlin, 23)).toBe(true)
    expect(isOffPeak(berlin, 12)).toBe(false)
  })

  it("off-peak window without wrap", () => {
    const toronto = REGIONS.find((r) => r.name === "Toronto, CA")! // [3,11)
    expect(isOffPeak(toronto, 5)).toBe(true)
    expect(isOffPeak(toronto, 12)).toBe(false)
  })

  it("cheap-power regions net more than expensive ones", () => {
    const o = regionPayout(oslo, 0.8, 12) // peak (no multiplier)
    const b = regionPayout(berlin, 0.8, 12)
    expect(o.net).toBeGreaterThan(b.net)
    expect(o.net).toBeGreaterThan(0)
  })

  it("off-peak applies the scheduling multiplier", () => {
    const peak = regionPayout(oslo, 0.8, 12) // Oslo off-peak is [21,5)
    const off = regionPayout(oslo, 0.8, 23)
    expect(off.offPeak).toBe(true)
    expect(off.multiplier).toBeGreaterThan(1)
    expect(off.net).toBeGreaterThan(peak.net)
  })
})
