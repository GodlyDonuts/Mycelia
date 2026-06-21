import { describe, it, expect } from "vitest"
import { partitionPipeline, type Layer, type PipeNode } from "@/lib/training/partition"

const layers: Layer[] = Array.from({ length: 12 }, () => ({ cost: 10, vramGb: 2 }))

describe("heterogeneity-aware pipeline partitioning", () => {
  it("covers every layer exactly once, in order", () => {
    const nodes: PipeNode[] = [
      { name: "a", vramGb: 100, tflops: 10 },
      { name: "b", vramGb: 100, tflops: 10 },
      { name: "c", vramGb: 100, tflops: 10 },
    ]
    const p = partitionPipeline(layers, nodes)
    expect(p.feasible).toBe(true)
    expect(p.stages[0].layers[0]).toBe(0)
    expect(p.stages[p.stages.length - 1].layers[1]).toBe(layers.length)
    for (let i = 1; i < p.stages.length; i++) expect(p.stages[i].layers[0]).toBe(p.stages[i - 1].layers[1])
  })

  it("gives the faster node more layers", () => {
    const nodes: PipeNode[] = [
      { name: "fast", vramGb: 100, tflops: 30 },
      { name: "slow", vramGb: 100, tflops: 10 },
    ]
    const p = partitionPipeline(layers, nodes)
    const fastLayers = p.stages[0].layers[1] - p.stages[0].layers[0]
    const slowLayers = p.stages[1].layers[1] - p.stages[1].layers[0]
    expect(fastLayers).toBeGreaterThan(slowLayers)
  })

  it("respects VRAM caps (a small-VRAM node gets fewer layers)", () => {
    const nodes: PipeNode[] = [
      { name: "tight", vramGb: 6, tflops: 10 }, // ≤3 layers (2GB each)
      { name: "big", vramGb: 100, tflops: 10 },
    ]
    const p = partitionPipeline(layers, nodes)
    expect(p.feasible).toBe(true)
    expect(p.stages[0].vramUsed).toBeLessThanOrEqual(6)
  })

  it("minimizes the bottleneck vs a naive equal split", () => {
    const nodes: PipeNode[] = [
      { name: "fast", vramGb: 100, tflops: 40 },
      { name: "slow", vramGb: 100, tflops: 10 },
    ]
    const p = partitionPipeline(layers, nodes)
    // equal split (6/6): slow stage = 60/10 = 6.0; optimizer should beat that
    expect(p.bottleneck).toBeLessThan(6.0)
  })
})
