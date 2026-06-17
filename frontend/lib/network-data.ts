// Typed mock data + domain types for the live Network Telemetry view.
//
// Everything here is realistic placeholder data driven by client-side
// intervals. In production every shape below is emitted by the scheduler's
// telemetry plane over a single SSE stream (or WebSocket):
//   - ClusterStat aggregates tick a few times per second.
//   - GraphNode / GraphLink describe the live mesh topology; nodes join/leave.
//   - RenderTile state flips to "done" as the mesh verifies each tile.
//   - LossPoint history appends one entry per aggregation round.
//   - NodeContribution updates as nodes submit gradients.
//   - NetEvent items push newest-first.
// Search for "SSE" comments in the components to see exactly where the
// interval simulations get swapped for the real stream.

export type NodeKind = "gpu" | "desktop" | "laptop" | "phone"

export type GraphNode = {
  id: string
  /** display label, e.g. "studio-rig" */
  label: string
  kind: NodeKind
  /** normalized compute capacity 0..1 — drives node radius */
  capacity: number
  /** current load 0..1 — drives node color (teal -> amber) */
  load: number
  gpu: string
  /** active job name, or null when idle */
  job: string | null
  /** layout position in a unit square (0..1) */
  x: number
  y: number
  /** set when a node is freshly joined so it can fade in */
  joinedAt?: number
}

export type GraphLink = {
  source: string
  target: string
  /** 0..1 — flow intensity, drives dash speed + opacity */
  flow: number
}

export type ClusterStat = {
  id: string
  label: string
  /** numeric value the component formats + smoothly animates toward */
  value: number
  /** unit suffix, e.g. "TFLOP/s" */
  unit?: string
  /** how to format: integer, 1-decimal, or thousands-grouped */
  fmt: "int" | "dec1" | "group"
}

export type RenderTileState = "done" | "computing" | "pending"

export type RenderTile = {
  id: number
  state: RenderTileState
  /** node currently computing / that computed this tile */
  node: string
  /** ms of GPU time spent on the tile */
  gpuMs: number
}

export type LossPoint = {
  round: number
  /** global validation loss */
  loss: number
}

export type NodeContribution = {
  node: string
  /** share of this round's gradient updates, 0..1 */
  share: number
}

export type NetEventKind =
  | "join"
  | "leave"
  | "fanout"
  | "tile-verified"
  | "round-aggregated"
  | "credited"

export type NetEvent = {
  id: string
  kind: NetEventKind
  node: string
  detail: string
  ts: number
}

// ---- Cluster header stats ----------------------------------------------

export const CLUSTER_STATS: ClusterStat[] = [
  { id: "nodes", label: "Nodes Online", value: 1284, fmt: "group" },
  { id: "gpus", label: "GPUs Online", value: 942, fmt: "group" },
  { id: "tflops", label: "Network TFLOP/s", value: 38420, fmt: "group", unit: "TF" },
  { id: "throughput", label: "Throughput", value: 12.7, fmt: "dec1", unit: "GB/s" },
  { id: "jobs", label: "Jobs Running", value: 217, fmt: "int" },
  { id: "jobsec", label: "Jobs / sec", value: 4.8, fmt: "dec1" },
]

// ---- Mesh topology ------------------------------------------------------

const KINDS: NodeKind[] = ["gpu", "gpu", "desktop", "gpu", "laptop", "desktop", "gpu", "phone", "desktop", "gpu"]
const GPUS = ["H100", "A100", "4090", "A10G", "T4", "4090", "A100", "—", "3090", "H100"]
const JOBS = [
  "llama-ft-7b · shard 04",
  "sd-xl-inference",
  "render-batch-1182",
  "fractal-deepzoom",
  null,
  "resnet-train-44",
  "llama-ft-7b · shard 01",
  null,
  "sim-fluid-9",
  "sd-xl-inference",
]

// Deterministic radial-ish layout (no Math.random for SSR stability).
function buildNodes(): GraphNode[] {
  const names = [
    "studio-rig",
    "render-node-a",
    "office-desktop",
    "deepzoom-gpu",
    "macbook-pro",
    "living-room-pc",
    "frankfurt-h100",
    "pixel-9-pro",
    "lab-tower",
    "render-node-b",
  ]
  return names.map((label, i) => {
    const angle = (i / names.length) * Math.PI * 2
    const ring = i % 3 === 0 ? 0.18 : i % 3 === 1 ? 0.34 : 0.46
    // center the hub node
    const isHub = i === 0
    return {
      id: `n${i}`,
      label,
      kind: KINDS[i],
      capacity: isHub ? 1 : 0.35 + ((i * 37) % 60) / 100,
      load: 0.3 + ((i * 53) % 65) / 100,
      gpu: GPUS[i],
      job: JOBS[i],
      x: isHub ? 0.5 : 0.5 + Math.cos(angle) * ring,
      y: isHub ? 0.5 : 0.5 + Math.sin(angle) * ring,
    }
  })
}

export const GRAPH_NODES: GraphNode[] = buildNodes()

// Hub-and-spoke + a few cross links to feel like a living mesh.
export const GRAPH_LINKS: GraphLink[] = [
  { source: "n0", target: "n1", flow: 0.9 },
  { source: "n0", target: "n2", flow: 0.5 },
  { source: "n0", target: "n3", flow: 0.8 },
  { source: "n0", target: "n6", flow: 0.7 },
  { source: "n0", target: "n8", flow: 0.6 },
  { source: "n1", target: "n4", flow: 0.4 },
  { source: "n1", target: "n9", flow: 0.75 },
  { source: "n2", target: "n5", flow: 0.3 },
  { source: "n3", target: "n9", flow: 0.55 },
  { source: "n6", target: "n8", flow: 0.65 },
  { source: "n6", target: "n7", flow: 0.2 },
  { source: "n8", target: "n5", flow: 0.35 },
]

/** Nodes that can "join" the mesh live, cycled by the graph component. */
export const JOINABLE_NODES: Omit<GraphNode, "x" | "y" | "joinedAt">[] = [
  { id: "j0", label: "tokyo-a100", kind: "gpu", capacity: 0.7, load: 0.4, gpu: "A100", job: "sd-xl-inference" },
  { id: "j1", label: "berlin-4090", kind: "gpu", capacity: 0.6, load: 0.55, gpu: "4090", job: "render-batch-1190" },
  { id: "j2", label: "thinkpad-x1", kind: "laptop", capacity: 0.3, load: 0.25, gpu: "T4", job: null },
]

// ---- Live render tiles --------------------------------------------------

export const TILE_GRID = 8 // 8x8 = 64 tiles

// Seed: ~40% already rendered, rest pending. The component flips pending ->
// computing -> done over time as the mesh "verifies" each tile.
function buildTiles(): RenderTile[] {
  const tiles: RenderTile[] = []
  const nodes = ["deepzoom-gpu", "render-node-a", "render-node-b", "frankfurt-h100", "studio-rig"]
  for (let i = 0; i < TILE_GRID * TILE_GRID; i++) {
    const seeded = (i * 7) % 5 === 0 || (i * 13) % 7 === 0
    tiles.push({
      id: i,
      state: seeded ? "done" : "pending",
      node: nodes[i % nodes.length],
      gpuMs: 120 + ((i * 29) % 380),
    })
  }
  return tiles
}

export const RENDER_TILES: RenderTile[] = buildTiles()

// ---- Training (LoRA fine-tune) ------------------------------------------

// Loss curve seed — exponential-ish decay with mild wobble.
function buildLoss(): LossPoint[] {
  const out: LossPoint[] = []
  for (let r = 0; r <= 18; r++) {
    const loss = 2.4 * Math.exp(-r / 6) + 0.18 + Math.sin(r / 2) * 0.03
    out.push({ round: r, loss: Math.round(loss * 1000) / 1000 })
  }
  return out
}

export const LOSS_HISTORY: LossPoint[] = buildLoss()

export const NODE_CONTRIB: NodeContribution[] = [
  { node: "studio-rig", share: 0.31 },
  { node: "frankfurt-h100", share: 0.27 },
  { node: "render-node-a", share: 0.19 },
  { node: "lab-tower", share: 0.14 },
  { node: "render-node-b", share: 0.09 },
]

// ---- Cluster utilization stream ----------------------------------------

export type UtilPoint = { t: number; util: number }

export function buildUtil(points = 48): UtilPoint[] {
  const out: UtilPoint[] = []
  for (let i = 0; i < points; i++) {
    const util = 62 + Math.sin(i / 5) * 12 + Math.cos(i / 11) * 7
    out.push({ t: i, util: Math.round(util) })
  }
  return out
}

export const UTIL_SEED: UtilPoint[] = buildUtil()

// ---- Network event log --------------------------------------------------

const t = Date.now()
export const NET_EVENTS: NetEvent[] = [
  { id: "ne1", kind: "round-aggregated", node: "scheduler", detail: "llama-ft-7b · round 18", ts: t - 1200 },
  { id: "ne2", kind: "tile-verified", node: "deepzoom-gpu", detail: "tile 41 · fractal", ts: t - 3400 },
  { id: "ne3", kind: "credited", node: "frankfurt-h100", detail: "+18.2 MYC", ts: t - 5200 },
  { id: "ne4", kind: "fanout", node: "scheduler", detail: "sd-xl-inference → 12 nodes", ts: t - 7000 },
  { id: "ne5", kind: "join", node: "tokyo-a100", detail: "the mesh", ts: t - 9800 },
  { id: "ne6", kind: "tile-verified", node: "render-node-a", detail: "tile 38 · fractal", ts: t - 12400 },
  { id: "ne7", kind: "leave", node: "thinkpad-x1", detail: "the mesh", ts: t - 15000 },
  { id: "ne8", kind: "credited", node: "studio-rig", detail: "+9.6 MYC", ts: t - 18200 },
]

// Samples the event log cycles through to simulate the live push feed.
export const NET_EVENT_SAMPLES: Omit<NetEvent, "id" | "ts">[] = [
  { kind: "tile-verified", node: "deepzoom-gpu", detail: "tile 47 · fractal" },
  { kind: "round-aggregated", node: "scheduler", detail: "llama-ft-7b · round 19" },
  { kind: "credited", node: "render-node-b", detail: "+14.1 MYC" },
  { kind: "fanout", node: "scheduler", detail: "render-batch-1191 → 8 nodes" },
  { kind: "join", node: "berlin-4090", detail: "the mesh" },
  { kind: "tile-verified", node: "frankfurt-h100", detail: "tile 52 · fractal" },
  { kind: "credited", node: "studio-rig", detail: "+11.8 MYC" },
  { kind: "leave", node: "pixel-9-pro", detail: "the mesh" },
]
