import { describe, it, expect } from "vitest"
import { splitReward, mycToUsd, PLATFORM_FEE } from "@/lib/myc"
import { JobSpecSchema, tierToCapabilityClass } from "@/lib/jobspec"

describe("MYC economics", () => {
  it("splitReward gives the platform exactly the fee and conserves the total", () => {
    const { provider, fee } = splitReward(10)
    expect(fee).toBeCloseTo(10 * PLATFORM_FEE, 6)
    expect(provider + fee).toBeCloseTo(10, 6)
  })

  it("mycToUsd uses the demo spot rate", () => {
    expect(mycToUsd(100)).toBe(12)
  })
})

describe("JobSpec schema (the ledger guard)", () => {
  const valid = {
    name: "test", type: "render", gpuTier: "4090",
    vram: 24, ram: 64, maxRuntimeMin: 30, replication: 2, rewardBid: 200,
  }

  it("accepts a valid spec and applies optional defaults", () => {
    const r = JobSpecSchema.parse(valid)
    expect(r.image).toBe("")
    expect(r.datasetUrl).toBe("")
  })

  it("rejects bad enums, missing fields, and out-of-range values", () => {
    expect(JobSpecSchema.safeParse({ ...valid, type: "bogus" }).success).toBe(false)
    expect(JobSpecSchema.safeParse({ ...valid, gpuTier: "Z9000" }).success).toBe(false)
    expect(JobSpecSchema.safeParse({ ...valid, rewardBid: 0 }).success).toBe(false)
    expect(JobSpecSchema.safeParse({ ...valid, replication: 99 }).success).toBe(false)
    expect(JobSpecSchema.safeParse({ name: "x" }).success).toBe(false)
  })

  it("maps GPU tiers to capability classes", () => {
    expect(tierToCapabilityClass("none")).toBe("cpu_only")
    expect(tierToCapabilityClass("A100")).toBe("gpu_a100")
  })
})
