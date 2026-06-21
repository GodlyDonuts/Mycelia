import { describe, it, expect } from "vitest"
import {
  initAdapter,
  genBatch,
  loss,
  localTrain,
  fedAvg,
  diLoCo,
  validationBatch,
  canaryBatch,
  verifyContribution,
  cosine,
  ADAPTER_DIM,
} from "@/lib/training/model"

describe("training model", () => {
  it("local SGD reduces loss on its own shard", () => {
    const shard = genBatch(42, 120)
    const before = loss(initAdapter(), shard)
    const after = loss(localTrain(initAdapter(), shard, 40, 0.08), shard)
    expect(after).toBeLessThan(before)
  })

  it("FedAvg over data-parallel cells converges on a held-out validation set", () => {
    const val = validationBatch()
    let global = initAdapter()
    const start = loss(global, val)
    for (let round = 0; round < 8; round++) {
      const locals = Array.from({ length: 5 }, (_, c) => {
        const n = 60 + c * 40
        return { theta: localTrain(global, genBatch(1000 + round * 10 + c, n), 30, 0.08), tokens: n }
      })
      global = fedAvg(locals)
    }
    const end = loss(global, val)
    expect(end).toBeLessThan(start * 0.1) // at least a 10x reduction
    expect(end).toBeLessThan(0.02)
  })

  it("DiLoCo outer step also reduces validation loss", () => {
    const val = validationBatch()
    let global = initAdapter()
    let momentum = initAdapter()
    const start = loss(global, val)
    for (let round = 0; round < 8; round++) {
      const locals = Array.from({ length: 5 }, (_, c) => ({
        theta: localTrain(global, genBatch(2000 + round * 10 + c, 100), 30, 0.08),
        tokens: 100,
      }))
      const step = diLoCo(global, locals, momentum)
      global = step.next
      momentum = step.momentum
    }
    expect(loss(global, val)).toBeLessThan(start)
  })

  it("canary verification accepts honest deltas and rejects garbage", () => {
    const canary = canaryBatch()
    const global = localTrain(initAdapter(), genBatch(7, 100), 20, 0.08)
    const honest = localTrain(global, genBatch(8, 100), 30, 0.08)
    const garbage = Array.from({ length: ADAPTER_DIM }, () => Math.random() * 8 - 4)
    expect(verifyContribution(global, honest, canary).accepted).toBe(true)
    expect(verifyContribution(global, garbage, canary).accepted).toBe(false)
  })

  it("rejects non-finite weights", () => {
    const bad = initAdapter()
    bad[0] = Number.NaN
    expect(verifyContribution(initAdapter(), bad, canaryBatch()).accepted).toBe(false)
  })

  it("cosine of identical directions is ~1", () => {
    const v = [1, 2, 3, 4]
    expect(cosine(v, v)).toBeCloseTo(1, 6)
    expect(cosine(v, [-1, -2, -3, -4])).toBeCloseTo(-1, 6)
  })
})
