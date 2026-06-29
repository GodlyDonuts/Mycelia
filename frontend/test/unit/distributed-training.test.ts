import { describe, it, expect, beforeEach } from "vitest"
import { aggregateDeltas, outerStep, resetOuterState, DEFAULT_DILOCO } from "@/lib/training/diloco"
import { buildEnvelope, verifySeqOrder } from "@/lib/training/transport"
import { assignShards } from "@/lib/training/heterogeneity"
import { proveTrainingStep, verifyProof } from "@/lib/zk/sp1-training"

describe("diloco outer optimizer", () => {
  beforeEach(() => resetOuterState())

  it("capability-weights cell deltas", () => {
    const dim = 4
    const cells = [
      { cellId: "A", delta: [1, 0, 0, 0], capability: 100, localSteps: 100 },
      { cellId: "B", delta: [0, 1, 0, 0], capability: 0, localSteps: 100 },
    ]
    const agg = aggregateDeltas(cells)
    expect(agg[0]).toBeCloseTo(1)
    expect(agg[1]).toBeCloseTo(0)
  })

  it("outer step moves theta", () => {
    const theta = [1, 1, 1, 1]
    const grad = [0.1, 0.1, 0.1, 0.1]
    outerStep(theta, grad, DEFAULT_DILOCO)
    expect(theta[0]).toBeLessThan(1)
  })
})

describe("transport envelopes", () => {
  it("orders pipeline sequences", () => {
    expect(verifySeqOrder(0, 1)).toBe(true)
    expect(verifySeqOrder(0, 2)).toBe(false)
  })

  it("estimates wire budget", () => {
    const env = buildEnvelope(1, 2, 0, 4096, 4, "us-east-1", "us-west-2", "in-process")
    expect(env.payloadBytes).toBe(4096 * 4 * 2)
    expect(env.rttMs).toBe(0)
  })
})

describe("heterogeneity sharding", () => {
  it("assigns more samples to faster nodes", () => {
    const nodes = [
      { nodeId: "fast", tokensPerSec: 1000, vramGb: 24, reliability: 1 },
      { nodeId: "slow", tokensPerSec: 100, vramGb: 8, reliability: 1 },
    ]
    const shards = assignShards(nodes, 1000)
    const fast = shards.find((s) => s.nodeId === "fast")!
    const slow = shards.find((s) => s.nodeId === "slow")!
    expect(fast.sampleCount).toBeGreaterThan(slow.sampleCount)
  })
})

describe("zk training attestation stub", () => {
  it("produces verifiable proof bundle", () => {
    const proof = proveTrainingStep({
      round: 1,
      cellId: "c",
      adapterBefore: "0xabc",
      adapterAfter: "0xdef",
      localSteps: 50,
      seed: 42,
      lossBefore: 2.0,
      lossAfter: 1.8,
    })
    expect(verifyProof(proof)).toBe(true)
  })
})
