// In-process training simulator (ML_LAYER.md §9 demo slice). Heterogeneous
// simulated cells pull round-tasks, run REAL local SGD on their shard, and
// submit adapter deltas — with one deliberately-bad delta injected per ~most
// rounds to show the canary-loss check reject it on stage. The same
// pull/contribute API is what a real external Python (PyTorch+PEFT) worker would
// call; this just stands in for the supply.

import { query, queryOne, num } from "../db"
import { DEMO_REQUESTER } from "../myc"
import { submitTrainingJob, pullRoundTask, submitContribution, flushStalledRounds } from "./coordinator"
import { genBatch, localTrain, initAdapter, ADAPTER_DIM } from "./model"

interface TState {
  timer: ReturnType<typeof setInterval> | null
  running: boolean
  seen: Set<string> // rounds we've decided bad-injection for
  injected: Set<string> // rounds we've already injected a bad delta into
}
declare global {
  // eslint-disable-next-line no-var
  var __mycelia_training: TState | undefined
}

const TICK_MS = 1500
const NODES_PER_TICK = 6

const MODELS = ["Qwen2.5-0.5B", "Llama-3.2-1B", "Qwen2.5-1.5B", "Llama-3.2-3B", "Phi-3.5-mini"]
let modelIdx = 0

function randomBadAdapter(): number[] {
  return Array.from({ length: ADAPTER_DIM }, () => Math.random() * 4 - 2)
}

async function topUpRequester() {
  const b = await queryOne<{ available_myc: string }>(
    `SELECT available_myc FROM account_balance WHERE account_id=$1`, [DEMO_REQUESTER])
  if (b && num(b.available_myc) < 3000) {
    await query(`UPDATE account_balance SET available_myc = available_myc + 50000 WHERE account_id=$1`, [DEMO_REQUESTER])
  }
}

async function ensureActiveTraining() {
  const active = await queryOne<{ id: string }>(`SELECT id FROM training_jobs WHERE status='running' LIMIT 1`)
  if (active) return
  await topUpRequester()
  const model = MODELS[modelIdx++ % MODELS.length]
  try {
    await submitTrainingJob({ name: `${model} LoRA · distributed`, baseModel: model, rewardBid: 1200, maxRounds: 24, hLocalSteps: 30 })
  } catch {
    /* ignore transient */
  }
}

async function pickNodes(n: number) {
  return query<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM nodes WHERE is_simulated=true AND status='online' AND gpu_model <> '—'
     ORDER BY random() LIMIT $1`,
    [n],
  )
}

async function tick(state: TState) {
  await flushStalledRounds()
  await ensureActiveTraining()
  const nodes = await pickNodes(NODES_PER_TICK)
  for (const node of nodes) {
    const task = await pullRoundTask({ id: node.id, name: node.display_name })
    if (!task) continue

    // decide once per round whether to inject a single bad delta (~70% of rounds)
    let bad = false
    if (!state.seen.has(task.roundId)) {
      state.seen.add(task.roundId)
      if (Math.random() < 0.7) bad = true // this first claim carries the bad delta
    }
    if (bad) state.injected.add(task.roundId)

    let localTheta: number[]
    if (bad) {
      localTheta = randomBadAdapter()
    } else {
      const shard = genBatch(task.shard.seed, task.shard.n)
      localTheta = localTrain(task.theta.length === ADAPTER_DIM ? task.theta : initAdapter(), shard, task.shard.steps, task.shard.lr)
    }
    await submitContribution({
      cellId: task.cellId,
      roundId: task.roundId,
      jobId: task.jobId,
      nodeId: node.id,
      nodeName: node.display_name,
      localTheta,
      tokens: task.shard.n,
      localSteps: task.shard.steps,
    })
  }
  // keep memory bounded
  if (state.seen.size > 500) state.seen.clear()
  if (state.injected.size > 500) state.injected.clear()
}

export function startTrainingDriver(): void {
  if (globalThis.__mycelia_training?.timer) return
  const state: TState = { timer: null, running: false, seen: new Set(), injected: new Set() }
  globalThis.__mycelia_training = state
  state.timer = setInterval(async () => {
    if (state.running) return
    state.running = true
    try {
      await tick(state)
    } catch (e) {
      console.error("[training] tick error", e)
    } finally {
      state.running = false
    }
  }, TICK_MS)
  ;(state.timer as { unref?: () => void }).unref?.()
}
