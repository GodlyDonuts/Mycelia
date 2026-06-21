import { describe, it, expect } from "vitest"
import { refereeRecompute, directionalAgreement } from "@/lib/training/refereed"
import { initAdapter, genBatch, localTrain, ADAPTER_DIM } from "@/lib/training/model"

const global = localTrain(initAdapter(), genBatch(1, 100), 20, 0.08)
const shard = { seed: 555, n: 120, steps: 30, lr: 0.08 }

describe("refereed-recompute for training", () => {
  it("clears an honestly-trained contribution", () => {
    const honest = localTrain(global, genBatch(shard.seed, shard.n), shard.steps, shard.lr)
    expect(refereeRecompute(global, shard, honest).honest).toBe(true)
  })

  it("catches a node that submitted a random (untrained) delta", () => {
    const fake = Array.from({ length: ADAPTER_DIM }, () => Math.random())
    const v = refereeRecompute(global, shard, fake)
    expect(v.honest).toBe(false)
    expect(v.diff).toBeGreaterThan(0)
  })

  it("catches a lazy node that ran fewer local steps", () => {
    const lazy = localTrain(global, genBatch(shard.seed, shard.n), 5, shard.lr) // claimed 30, did 5
    expect(refereeRecompute(global, shard, lazy).honest).toBe(false)
  })
})

describe("redundant-shard directional agreement", () => {
  it("two honest cells on the same shard agree in direction", () => {
    const a = localTrain(global, genBatch(shard.seed, shard.n), shard.steps, shard.lr)
    const b = localTrain(global, genBatch(shard.seed, shard.n + 40), shard.steps, shard.lr) // same shard, more data
    expect(directionalAgreement(global, a, b).agree).toBe(true)
  })

  it("a poisoned delta disagrees in direction", () => {
    const honest = localTrain(global, genBatch(shard.seed, shard.n), shard.steps, shard.lr)
    const poison = global.map((g, i) => g - (honest[i] - g)) // opposite direction
    expect(directionalAgreement(global, honest, poison).agree).toBe(false)
  })
})
