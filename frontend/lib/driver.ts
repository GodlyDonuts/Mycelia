// In-process driver + simulator (PLAN.md §3 Tier-2 stub: "a single local
// process that fuses the coordinator driver and the simulator"). Here the Next
// dev server IS our long-lived local process, so the loop legitimately lives in
// a background interval — every state read/write still goes through the same
// stateless coordinator functions and the one shared DB connection.

import { query, queryOne, num } from "./db"
import { submitJob, pullWork, submitResult, settle, computeTile, bytesToBase64 } from "./coordinator"
import { DEFAULT_RENDER, type JobRenderParams } from "./fractal"
import { DEMO_REQUESTER } from "./myc"

interface DriverState {
  timer: ReturnType<typeof setInterval> | null
  running: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var __mycelia_driver: DriverState | undefined
}

const TICK_MS = 1300
const TILES_PER_TICK = 5

// Interesting Mandelbrot neighbourhoods the driver zooms into for variety.
const SPOTS: Array<Pick<JobRenderParams, "cx" | "cy" | "scale" | "maxIter">> = [
  { cx: -0.743643887037151, cy: 0.13182590420533, scale: 0.0008, maxIter: 360 },
  { cx: -0.10109636384562, cy: 0.95628651080914, scale: 0.0009, maxIter: 420 },
  { cx: 0.2929859127507, cy: 0.6117848324958, scale: 0.0014, maxIter: 380 },
  { cx: -1.2568840461035, cy: 0.3796264987532, scale: 0.0006, maxIter: 440 },
  { cx: -0.748, cy: 0.1, scale: 0.0025, maxIter: 320 },
]
let spotIdx = 0

async function topUpRequester() {
  const b = await queryOne<{ available_myc: string }>(
    `SELECT available_myc FROM account_balance WHERE account_id=$1`, [DEMO_REQUESTER])
  if (b && num(b.available_myc) < 2000) {
    await query(`UPDATE account_balance SET available_myc = available_myc + 50000 WHERE account_id=$1`, [DEMO_REQUESTER])
  }
}

/** Find a running render with pending tiles, or start a fresh zoom. */
async function ensureActiveRender(): Promise<string | null> {
  const active = await queryOne<{ id: string }>(
    `SELECT j.id FROM jobs j
     WHERE j.type='render' AND j.status='running'
       AND EXISTS (SELECT 1 FROM tiles t WHERE t.job_id=j.id AND t.status<>'verified')
     ORDER BY j.created_at DESC LIMIT 1`,
  )
  if (active) return active.id
  await topUpRequester()
  const spot = SPOTS[spotIdx++ % SPOTS.length]
  const render = { ...DEFAULT_RENDER, ...spot }
  try {
    const { jobId } = await submitJob(
      {
        name: "deep-zoom mandelbrot · live",
        type: "render",
        gpuTier: "4090",
        vram: 24,
        ram: 64,
        maxRuntimeMin: 30,
        replication: 4,
        rewardBid: render.maxIter, // ~ matches 64 tiles * 8
        image: "",
        datasetUrl: "",
      },
      { render },
    )
    return jobId
  } catch {
    return null
  }
}

/** Online simulated nodes that can take work this tick. */
async function pickSimNodes(n: number) {
  return query<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM nodes WHERE is_simulated=true AND status='online' ORDER BY random() LIMIT $1`,
    [n],
  )
}

async function jitterTelemetry() {
  await query(
    `UPDATE node_telemetry_current SET
       cpu_pct = GREATEST(0, LEAST(100, cpu_pct + (random()*16 - 8))),
       gpu_pct = GREATEST(0, LEAST(100, gpu_pct + (random()*20 - 10))),
       ram_pct = GREATEST(0, LEAST(100, ram_pct + (random()*10 - 5))),
       updated_at = now()
     WHERE node_id IN (SELECT node_id FROM node_telemetry_current ORDER BY random() LIMIT 12)`,
  )
}

async function tick() {
  const jobId = await ensureActiveRender()
  if (!jobId) return
  const nodes = await pickSimNodes(TILES_PER_TICK)
  for (const n of nodes) {
    const claim = await pullWork({ id: n.id, name: n.display_name }, jobId)
    if (!claim) continue
    const bytes = computeTile(claim.params, claim.tileIndex)
    const b64 = bytesToBase64(bytes)
    const gpuMs = 80 + Math.floor(Math.random() * 320)
    await submitResult({ tileId: claim.tileId, nodeId: n.id, nodeName: n.display_name, resultB64: b64, gpuMs })
  }
  await jitterTelemetry()
}

export function startDriver(): void {
  if (globalThis.__mycelia_driver?.timer) return
  const state: DriverState = { timer: null, running: false }
  globalThis.__mycelia_driver = state
  state.timer = setInterval(async () => {
    if (state.running) return
    state.running = true
    try {
      await tick()
    } catch (e) {
      // keep the demo alive on transient errors
      console.error("[driver] tick error", e)
    } finally {
      state.running = false
    }
  }, TICK_MS)
  // Node: don't keep the event loop alive solely for this timer.
  ;(state.timer as { unref?: () => void }).unref?.()
}

export function driverStatus() {
  return { running: !!globalThis.__mycelia_driver?.timer }
}
