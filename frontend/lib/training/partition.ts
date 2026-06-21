// Heterogeneity-aware pipeline partitioning (docs/ML_LAYER.md §3/§4: "assign more
// layers to bigger-VRAM nodes and balance per-stage compute so the slowest stage
// — which gates the pipeline — is minimized"). Assign contiguous layer ranges to
// pipeline stages (nodes in order), respecting each node's VRAM, minimizing the
// bottleneck stage time. Binary-search the bottleneck + greedy feasibility.

export interface PipeNode {
  name: string
  vramGb: number
  tflops: number // throughput
}
export interface Layer {
  cost: number // relative compute (e.g. GFLOPs/step)
  vramGb: number
}
export interface Stage {
  node: string
  layers: [number, number] // [start, end) layer indices
  stageTime: number // cost / throughput
  vramUsed: number
}
export interface Partition {
  stages: Stage[]
  bottleneck: number // max stage time (gates the pipeline)
  feasible: boolean
}

function tryPack(layers: Layer[], nodes: PipeNode[], T: number): Array<[number, number]> | null {
  const ranges: Array<[number, number]> = []
  let li = 0
  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni]
    const start = li
    let cost = 0
    let vram = 0
    const remainingNodes = nodes.length - ni - 1
    while (li < layers.length) {
      const L = layers[li]
      const newCost = cost + L.cost
      const newVram = vram + L.vramGb
      const fits = newCost / node.tflops <= T + 1e-9 && newVram <= node.vramGb + 1e-9
      // leave at least one layer per remaining downstream node
      const mustLeave = layers.length - (li + 1) < remainingNodes
      if (fits && !mustLeave) {
        cost = newCost
        vram = newVram
        li++
      } else if (fits && mustLeave) {
        cost = newCost
        vram = newVram
        li++
        break
      } else break
    }
    ranges.push([start, li])
    if (li >= layers.length) {
      // pad remaining nodes with empty ranges
      for (let k = ni + 1; k < nodes.length; k++) ranges.push([li, li])
      return ranges
    }
  }
  return li >= layers.length ? ranges : null
}

export function partitionPipeline(layers: Layer[], nodes: PipeNode[]): Partition {
  const totalCost = layers.reduce((s, l) => s + l.cost, 0)
  const minTput = Math.min(...nodes.map((n) => n.tflops))
  let lo = 0
  let hi = totalCost / minTput // worst case: all on the slowest node
  let best: Array<[number, number]> | null = null
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2
    const packed = tryPack(layers, nodes, mid)
    if (packed) {
      best = packed
      hi = mid
    } else lo = mid
  }
  if (!best) return { stages: [], bottleneck: Infinity, feasible: false }

  const stages: Stage[] = best.map(([s, e], i) => {
    const cost = layers.slice(s, e).reduce((a, l) => a + l.cost, 0)
    const vram = layers.slice(s, e).reduce((a, l) => a + l.vramGb, 0)
    return { node: nodes[i].name, layers: [s, e], stageTime: Math.round((cost / nodes[i].tflops) * 1000) / 1000, vramUsed: Math.round(vram * 100) / 100 }
  })
  return { stages, bottleneck: Math.max(...stages.map((s) => s.stageTime)), feasible: true }
}
