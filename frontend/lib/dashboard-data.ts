// Typed mock data + domain types for the Contributor ("Cultivator") dashboard.
//
// Everything here is realistic placeholder data. In production these shapes
// are what the live telemetry layer will emit:
//   - StatCard values arrive from the scheduler's aggregate metrics feed.
//   - NodeTelemetry (cpu/gpu/ram/job) streams over a per-node heartbeat
//     (WebSocket / SSE) — see the comments in <NodeCard /> and useNodeTelemetry.
//   - EarningsPoint history is fetched once, then appended live at epoch close.
//   - EventLogEntry items push in newest-first over the same socket.

export type DeviceType = "laptop" | "desktop" | "gpu" | "phone"
export type NodeStatus = "online" | "idle" | "offline"

export type SparkPoint = { i: number; v: number }

export type StatCardData = {
  id: string
  label: string
  /** primary mono value, already formatted for display */
  value: string
  /** smaller secondary line, e.g. USD estimate */
  sub?: string
  /** percentage change vs previous period; sign drives color/arrow */
  delta: number
  deltaLabel?: string
  spark: SparkPoint[]
}

export type NodeJob = {
  name: string
  /** 0–100 completion of the current job */
  progress: number
} | null

export type NodeData = {
  id: string
  name: string
  type: DeviceType
  status: NodeStatus
  /** live gauges, 0–100 */
  cpu: number
  gpu: number
  ram: number
  job: NodeJob
  /** MYC earned in the current epoch */
  epochEarnings: number
  location: string
}

export type EarningsPoint = {
  /** ISO date (day granularity) */
  date: string
  myc: number
  /** present only on days a payout settled — rendered as an amber marker */
  payout?: number
}

export type EventKind = "join" | "leave" | "assigned" | "completed" | "credited"

export type EventLogEntry = {
  id: string
  kind: EventKind
  node: string
  /** human label, e.g. "+12.4 MYC" or "resnet-train-44" */
  detail: string
  /** unix ms */
  ts: number
}

// ---- StatCards ----------------------------------------------------------

function spark(seed: number[]): SparkPoint[] {
  return seed.map((v, i) => ({ i, v }))
}

export const STAT_CARDS: StatCardData[] = [
  {
    id: "earnings",
    label: "Total Earnings",
    value: "48,210 MYC",
    sub: "≈ $5,785 USD",
    delta: 12.4,
    deltaLabel: "vs last epoch",
    spark: spark([28, 31, 30, 35, 38, 37, 42, 41, 45, 46, 48]),
  },
  {
    id: "nodes",
    label: "Active Nodes",
    value: "6",
    sub: "of 8 enrolled",
    delta: 0,
    deltaLabel: "no change",
    spark: spark([5, 6, 6, 5, 6, 7, 6, 6, 6, 6, 6]),
  },
  {
    id: "compute",
    label: "Compute Today",
    value: "14.8 GPU-h",
    sub: "+ 9.2 CPU-h",
    delta: 8.1,
    deltaLabel: "vs yesterday",
    spark: spark([6, 8, 7, 9, 11, 10, 12, 13, 12, 14, 14.8]),
  },
  {
    id: "rank",
    label: "Network Rank",
    value: "#3,418",
    sub: "Top 2% of cultivators",
    delta: 4.6,
    deltaLabel: "climbed 162",
    spark: spark([2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.3, 2.2, 2.1, 2.05, 2.0]),
  },
]

// ---- Nodes --------------------------------------------------------------

export const NODES: NodeData[] = [
  {
    id: "node-1",
    name: "studio-rig",
    type: "gpu",
    status: "online",
    cpu: 42,
    gpu: 91,
    ram: 68,
    job: { name: "llama-ft-7b · shard 04", progress: 73 },
    epochEarnings: 312.4,
    location: "Berlin, DE",
  },
  {
    id: "node-2",
    name: "office-desktop",
    type: "desktop",
    status: "online",
    cpu: 64,
    gpu: 38,
    ram: 51,
    job: { name: "render-batch-1182", progress: 41 },
    epochEarnings: 88.2,
    location: "Berlin, DE",
  },
  {
    id: "node-3",
    name: "macbook-pro",
    type: "laptop",
    status: "idle",
    cpu: 8,
    gpu: 3,
    ram: 22,
    job: null,
    epochEarnings: 19.6,
    location: "Lisbon, PT",
  },
  {
    id: "node-4",
    name: "render-node-a",
    type: "gpu",
    status: "online",
    cpu: 55,
    gpu: 84,
    ram: 77,
    job: { name: "sd-xl-inference", progress: 92 },
    epochEarnings: 241.9,
    location: "Frankfurt, DE",
  },
  {
    id: "node-5",
    name: "living-room-pc",
    type: "desktop",
    status: "idle",
    cpu: 12,
    gpu: 6,
    ram: 30,
    job: null,
    epochEarnings: 7.1,
    location: "Berlin, DE",
  },
  {
    id: "node-6",
    name: "pixel-9-pro",
    type: "phone",
    status: "offline",
    cpu: 0,
    gpu: 0,
    ram: 0,
    job: null,
    epochEarnings: 2.4,
    location: "Lisbon, PT",
  },
]

// ---- Earnings history (90 days, with periodic payout events) -----------

function buildEarnings(): EarningsPoint[] {
  const out: EarningsPoint[] = []
  const today = new Date()
  let base = 900
  for (let d = 89; d >= 0; d--) {
    const date = new Date(today)
    date.setDate(today.getDate() - d)
    // gentle upward drift with deterministic wobble (no Math.random for SSR stability)
    const wobble = Math.sin(d / 4) * 120 + Math.cos(d / 9) * 90
    base += 9
    const myc = Math.max(220, Math.round(base + wobble + (89 - d) * 4))
    const isPayout = d % 14 === 0 && d !== 0
    out.push({
      date: date.toISOString().slice(0, 10),
      myc,
      payout: isPayout ? Math.round(myc * 6.5) : undefined,
    })
  }
  return out
}

export const EARNINGS_90D: EarningsPoint[] = buildEarnings()

export const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const

export type RangeDays = (typeof RANGE_OPTIONS)[number]["days"]

// ---- Event log ----------------------------------------------------------

const now = Date.now()
export const EVENT_LOG: EventLogEntry[] = [
  { id: "e1", kind: "credited", node: "studio-rig", detail: "+12.4 MYC", ts: now - 1000 * 24 },
  { id: "e2", kind: "completed", node: "render-node-a", detail: "sd-xl-inference", ts: now - 1000 * 96 },
  { id: "e3", kind: "assigned", node: "studio-rig", detail: "llama-ft-7b · shard 04", ts: now - 1000 * 240 },
  { id: "e4", kind: "join", node: "office-desktop", detail: "the mesh", ts: now - 1000 * 600 },
  { id: "e5", kind: "credited", node: "render-node-a", detail: "+31.0 MYC", ts: now - 1000 * 900 },
  { id: "e6", kind: "leave", node: "pixel-9-pro", detail: "the mesh", ts: now - 1000 * 1500 },
  { id: "e7", kind: "completed", node: "office-desktop", detail: "render-batch-1180", ts: now - 1000 * 2100 },
  { id: "e8", kind: "assigned", node: "render-node-a", detail: "sd-xl-inference", ts: now - 1000 * 2600 },
]
