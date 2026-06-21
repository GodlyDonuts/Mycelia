import { describe, it, expect } from "vitest"
import { initModel, monolithic, pipeline, applyGrads, gradDiff, serve, D, H } from "@/lib/training/pipeline"

function teacher() {
  return initModel(0xfeed)
}
function sample(seed: number): number[] {
  // deterministic pseudo-random input
  let a = seed >>> 0
  return Array.from({ length: D }, () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
  })
}

describe("model-sharded pipeline (Regime 2)", () => {
  it("pipeline forward + grads are IDENTICAL to monolithic (sharding correctness)", () => {
    const m = initModel(1)
    for (let s = 0; s < 25; s++) {
      const z = sample(100 + s)
      const target = Math.sin(s)
      const mono = monolithic(m, z, target)
      const pipe = pipeline(m, z, target)
      expect(pipe.y).toBeCloseTo(mono.y, 12)
      expect(pipe.loss).toBeCloseTo(mono.loss, 12)
      expect(gradDiff(pipe.grads, mono.grads)).toBeLessThan(1e-12)
    }
  })

  it("training across the pipeline reduces loss (student → teacher)", () => {
    const teach = teacher()
    let student = initModel(7)
    const data = Array.from({ length: 32 }, (_, i) => {
      const z = sample(900 + i)
      return { z, t: monolithic(teach, z, 0).y } // label from the teacher
    })
    const lossOf = () => data.reduce((s, d) => s + pipeline(student, d.z, d.t).loss, 0) / data.length
    const start = lossOf()
    for (let epoch = 0; epoch < 200; epoch++) {
      for (const d of data) {
        const { grads } = pipeline(student, d.z, d.t)
        student = applyGrads(student, grads, 0.05)
      }
    }
    expect(lossOf()).toBeLessThan(start * 0.2)
  })

  it("pipeline serving (forward) equals monolithic forward", () => {
    const m = initModel(4)
    for (let s = 0; s < 20; s++) {
      const z = sample(500 + s)
      expect(serve(m, z)).toBeCloseTo(monolithic(m, z, 0).y, 12)
    }
  })

  it("stage shapes match the split (W1 on stage 1, w2 on stage 2)", () => {
    const m = initModel(2)
    expect(m.W1.length).toBe(H)
    expect(m.W1[0].length).toBe(D)
    expect(m.w2.length).toBe(H)
  })
})
