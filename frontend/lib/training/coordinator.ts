// Distributed-training coordinator (docs/ML_LAYER.md §6). Maps the training-job
// lifecycle onto the same stateless-handler + shared-connection model as the
// render coordinator: submit → form cells → dispatch round-task → local train →
// aggregate (the one new server-side primitive) → settle credits → loop.

import { query, queryOne, withTx, num } from "../db"
import { DEMO_REQUESTER, PLATFORM_ACCOUNT, splitReward } from "../myc"
import {
  type Adapter,
  initAdapter,
  genBatch,
  loss,
  fedAvg,
  validationBatch,
  canaryBatch,
  verifyContribution,
  cosine,
} from "./model"

const CELLS_PER_ROUND = 6
const QUORUM = 4
const SHARD_BASE = 700000

const toRef = (a: Adapter) => JSON.stringify(a)
const fromRef = (s: string | null): Adapter => (s ? (JSON.parse(s) as Adapter) : initAdapter())

async function logEvent(kind: string, node: string | null, detail: string) {
  await query(`INSERT INTO net_events(kind,node_name,detail) VALUES ($1,$2,$3)`, [kind, node, detail])
}

// ---- /training/submit ------------------------------------------------------

export interface TrainingSpec {
  name?: string
  baseModel?: string
  dataset?: string
  rank?: number
  hLocalSteps?: number
  maxRounds?: number
  targetValLoss?: number
  rewardBid?: number
}

export async function submitTrainingJob(
  spec: TrainingSpec = {},
  requesterId = DEMO_REQUESTER,
): Promise<{ jobId: string }> {
  const name = spec.name ?? "LoRA fine-tune · distributed"
  const h = spec.hLocalSteps ?? 30
  const maxRounds = spec.maxRounds ?? 24
  const target = spec.targetValLoss ?? 0.003 // just above the noise floor → a rich multi-round curve
  const reward = Math.round(spec.rewardBid ?? 1200)
  const lora = { rank: spec.rank ?? 16, alpha: 32, target_modules: ["q_proj", "v_proj"], dropout: 0.05 }

  return withTx(async (tx) => {
    const bal = await tx.queryOne<{ ok: boolean }>(
      `UPDATE account_balance SET available_myc = available_myc - $1, reserved_myc = reserved_myc + $1, updated_at=now()
       WHERE account_id=$2 AND available_myc >= $1 RETURNING true AS ok`,
      [reward, requesterId],
    )
    if (!bal) throw new Error("INSUFFICIENT_FUNDS")

    const theta0 = toRef(initAdapter())
    const job = await tx.queryOne<{ id: string }>(
      `INSERT INTO training_jobs(requester_id,name,base_model_ref,dataset_ref,lora_config,h_local_steps,max_rounds,target_val_loss,current_round,global_adapter_ref,val_loss,status,reward_bid_myc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,NULL,'running',$10) RETURNING id`,
      [requesterId, name, spec.baseModel ?? "Qwen2.5-0.5B", spec.dataset ?? "s3://mycelia/instruct-shard",
       JSON.stringify(lora), h, maxRounds, target, theta0, reward],
    )
    const jobId = job!.id
    await tx.query(
      `INSERT INTO ledger_entries(account_id,job_id,amount_myc,entry_type,idempotency_key,memo)
       VALUES ($1,$2,$3,'escrow_hold',$4,'training escrow')`,
      [requesterId, jobId, -reward, `t-escrow-${jobId}`],
    )
    await createRound(tx, jobId, 0, theta0)
    await tx.query(`INSERT INTO net_events(kind,node_name,detail) VALUES ('fanout','scheduler',$1)`, [
      `${name} → round 0 · ${CELLS_PER_ROUND} cells`,
    ])
    return { jobId }
  })
}

// Create a round + its forming cells (Regime 1: one node per cell).
async function createRound(tx: { query: (s: string, p?: unknown[]) => Promise<unknown[]> }, jobId: string, roundIndex: number, adapterRef: string) {
  const round = (await tx.query(
    `INSERT INTO training_rounds(job_id,round_index,adapter_ref_in,quorum_required,deltas_received,status)
     VALUES ($1,$2,$3,$4,0,'dispatched') RETURNING id`,
    [jobId, roundIndex, adapterRef, QUORUM],
  )) as Array<{ id: string }>
  const roundId = round[0].id
  for (let c = 0; c < CELLS_PER_ROUND; c++) {
    // Heterogeneous shards: later cells get more data + steps (stronger nodes).
    const shard = { seed: SHARD_BASE + roundIndex * 100 + c, n: 60 + c * 45, steps: 25 + c * 8, lr: 0.08 }
    await tx.query(
      `INSERT INTO cells(job_id,round_id,kind,capability_class,data_shard_ref,status)
       VALUES ($1,$2,'solo','gpu',$3,'forming')`,
      [jobId, roundId, JSON.stringify(shard)],
    )
  }
  return roundId
}

// ---- /training/pull (round-task) ------------------------------------------

export interface RoundTask {
  cellId: string
  jobId: string
  roundId: string
  roundIndex: number
  theta: Adapter
  shard: { seed: number; n: number; steps: number; lr: number }
  hLocalSteps: number
}

export async function pullRoundTask(node: { id: string; name: string }): Promise<RoundTask | null> {
  const claimed = await queryOne<{
    id: string; job_id: string; round_id: string; data_shard_ref: string
  }>(
    `UPDATE cells SET status='assigned', member_node_ids = ('{' || $1 || '}')::uuid[], assigned_at=now()
     WHERE id = (
       SELECT c.id FROM cells c
       JOIN training_rounds r ON r.id = c.round_id
       JOIN training_jobs j ON j.id = c.job_id
       WHERE c.status='forming' AND r.status='dispatched' AND j.status='running'
       ORDER BY random() LIMIT 1
     )
     RETURNING id, job_id, round_id, data_shard_ref`,
    [node.id],
  )
  if (!claimed) return null
  // data_shard_ref is a TEXT column — parse the JSON descriptor.
  const shard =
    typeof claimed.data_shard_ref === "string"
      ? (JSON.parse(claimed.data_shard_ref) as { seed: number; n: number; steps: number; lr: number })
      : (claimed.data_shard_ref as unknown as { seed: number; n: number; steps: number; lr: number })
  const job = await queryOne<{ global_adapter_ref: string; h_local_steps: number; round_index: number }>(
    `SELECT j.global_adapter_ref, j.h_local_steps, r.round_index
     FROM training_jobs j JOIN training_rounds r ON r.id=$2 WHERE j.id=$1`,
    [claimed.job_id, claimed.round_id],
  )
  const round = await queryOne<{ adapter_ref_in: string; round_index: number }>(
    `SELECT adapter_ref_in, round_index FROM training_rounds WHERE id=$1`, [claimed.round_id])
  return {
    cellId: claimed.id,
    jobId: claimed.job_id,
    roundId: claimed.round_id,
    roundIndex: round?.round_index ?? 0,
    theta: fromRef(round?.adapter_ref_in ?? job?.global_adapter_ref ?? null),
    shard,
    hLocalSteps: job?.h_local_steps ?? 30,
  }
}

// ---- /training/submit-contribution ----------------------------------------

export interface ContributionOut {
  ok: boolean
  accepted: boolean
  canaryLossDelta: number
  reason: string
  roundAggregated: boolean
}

export async function submitContribution(input: {
  cellId: string
  roundId: string
  jobId: string
  nodeId: string
  nodeName: string
  localTheta: Adapter
  tokens: number
  localSteps: number
}): Promise<ContributionOut> {
  const round = await queryOne<{ adapter_ref_in: string; status: string; round_index: number }>(
    `SELECT adapter_ref_in, status, round_index FROM training_rounds WHERE id=$1`, [input.roundId])
  if (!round || round.status !== "dispatched") {
    return { ok: false, accepted: false, canaryLossDelta: 0, reason: "round closed", roundAggregated: false }
  }
  const global = fromRef(round.adapter_ref_in)
  const check = verifyContribution(global, input.localTheta, canaryBatch())

  // Record the contribution + cell + counter atomically, re-checking the round
  // is still dispatched (so we never tell a node "accepted" after the round has
  // been claimed for aggregation). aggregateRound runs OUTSIDE this tx to avoid
  // the single-connection deadlock.
  const res = await withTx(async (tx) => {
    const still = await tx.queryOne<{ status: string }>(`SELECT status FROM training_rounds WHERE id=$1`, [input.roundId])
    if (!still || still.status !== "dispatched") return { state: "closed" as const }

    await tx.query(
      `INSERT INTO contributions(round_id,job_id,node_id,node_name,delta_ref,tokens_processed,local_steps,canary_loss_delta,accepted,vote_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [input.roundId, input.jobId, input.nodeId, input.nodeName, check.accepted ? toRef(input.localTheta) : null,
       input.tokens, input.localSteps, check.canaryLossDelta, check.accepted, check.accepted ? "accepted" : "rejected"],
    )
    await tx.query(`UPDATE cells SET status='submitted' WHERE id=$1`, [input.cellId])
    if (!check.accepted) {
      await tx.query(`INSERT INTO reputation_events(node_id,kind,delta) VALUES ($1,'fail',-2)`, [input.nodeId])
      return { state: "rejected" as const }
    }
    const upd = await tx.queryOne<{ deltas_received: number; quorum_required: number }>(
      `UPDATE training_rounds SET deltas_received = deltas_received + 1 WHERE id=$1 AND status='dispatched'
       RETURNING deltas_received, quorum_required`,
      [input.roundId],
    )
    return { state: "accepted" as const, upd }
  })

  if (res.state === "closed") {
    return { ok: false, accepted: false, canaryLossDelta: check.canaryLossDelta, reason: "round closed", roundAggregated: false }
  }
  if (res.state === "rejected") {
    await logEvent("delta-rejected", input.nodeName, `Δ rejected · ${check.reason}`)
    return { ok: true, accepted: false, canaryLossDelta: check.canaryLossDelta, reason: check.reason, roundAggregated: false }
  }

  await logEvent("delta-accepted", input.nodeName, `Δ accepted · round ${round.round_index}`)
  let roundAggregated = false
  if (res.upd && res.upd.deltas_received >= res.upd.quorum_required) {
    roundAggregated = await aggregateRound(input.jobId, input.roundId)
  }
  return { ok: true, accepted: true, canaryLossDelta: check.canaryLossDelta, reason: check.reason, roundAggregated }
}

// ---- aggregation worker (the one new primitive, ML_LAYER §6) ---------------

async function aggregateRound(jobId: string, roundId: string): Promise<boolean> {
  // claim the round for aggregation (idempotent)
  const claim = await queryOne<{ id: string }>(
    `UPDATE training_rounds SET status='aggregating' WHERE id=$1 AND status='dispatched' RETURNING id`, [roundId])
  if (!claim) return false

  const job = await queryOne<{ current_round: number; max_rounds: number; target_val_loss: string; reward_bid_myc: string; name: string; requester_id: string; global_adapter_ref: string }>(
    `SELECT current_round, max_rounds, target_val_loss, reward_bid_myc, name, requester_id, global_adapter_ref FROM training_jobs WHERE id=$1`, [jobId])
  if (!job) return false

  const accepted = await query<{ id: string; node_id: string; node_name: string; delta_ref: string; tokens_processed: string }>(
    `SELECT id, node_id, node_name, delta_ref, tokens_processed FROM contributions WHERE round_id=$1 AND accepted=true`, [roundId])
  if (accepted.length === 0) {
    await query(`UPDATE training_rounds SET status='timed_out', aggregated_at=now() WHERE id=$1`, [roundId])
    return false
  }

  const globalBefore = fromRef(job.global_adapter_ref)
  const locals = accepted.map((c) => ({ theta: fromRef(c.delta_ref), tokens: num(c.tokens_processed) }))
  // token-weighted FedAvg (ML_LAYER §3)
  const next = fedAvg(locals)
  const nextRef = toRef(next)
  const valLoss = Math.round(loss(next, validationBatch()) * 1e6) / 1e6

  const roundIndex = job.current_round
  const isLastRound = roundIndex + 1 >= job.max_rounds
  const hitTarget = valLoss <= num(job.target_val_loss)

  // pay this round's budget, token-weighted across accepted contributions
  const perRound = num(job.reward_bid_myc) / job.max_rounds
  const totalTokens = locals.reduce((s, l) => s + Math.max(1, l.tokens), 0)
  await withTx(async (tx) => {
    await tx.query(`UPDATE training_rounds SET adapter_ref_out=$2, val_loss=$3, status='done', aggregated_at=now() WHERE id=$1`,
      [roundId, nextRef, valLoss])
    await tx.query(`UPDATE training_jobs SET global_adapter_ref=$2, val_loss=$3, current_round=$4 WHERE id=$1`,
      [jobId, nextRef, valLoss, roundIndex + 1])

    for (let i = 0; i < accepted.length; i++) {
      const c = accepted[i]
      const share = (Math.max(1, num(c.tokens_processed)) / totalTokens) * perRound
      const { provider, fee } = splitReward(share)
      const ownerRow = await tx.queryOne<{ user_id: string }>(`SELECT user_id FROM nodes WHERE id=$1`, [c.node_id])
      const ownerId = ownerRow?.user_id ?? c.node_id
      await tx.query(
        `INSERT INTO ledger_entries(account_id,job_id,amount_myc,entry_type,idempotency_key)
         VALUES ($1,$2,$3,'provider_earn',$4)`,
        [ownerId, jobId, provider, `t-pay-${c.id}`],
      )
      await tx.query(
        `INSERT INTO ledger_entries(account_id,job_id,amount_myc,entry_type,idempotency_key)
         VALUES ($1,$2,$3,'platform_fee',$4)`,
        [PLATFORM_ACCOUNT, jobId, fee, `t-fee-${c.id}`],
      )
      await tx.query(`UPDATE contributions SET reward_myc=$2 WHERE id=$1`, [c.id, Math.round(provider * 100) / 100])
      await tx.query(`UPDATE node_telemetry_current SET epoch_earnings_myc = epoch_earnings_myc + $1, updated_at=now() WHERE node_id=$2`,
        [provider, c.node_id])
    }
    await tx.query(`UPDATE account_balance SET reserved_myc = GREATEST(0, reserved_myc - $1), updated_at=now() WHERE account_id=$2`,
      [perRound, job.requester_id])

    if (isLastRound || hitTarget) {
      await tx.query(`UPDATE training_jobs SET status='completed' WHERE id=$1`, [jobId])
      // Refund only THIS job's unspent escrow (reward − what it actually paid out).
      // reserved_myc is shared across all in-flight jobs, so it must never be zeroed.
      const paidRow = await tx.queryOne<{ p: string }>(
        `SELECT coalesce(sum(amount_myc),0)::float8 AS p FROM ledger_entries
         WHERE job_id=$1 AND entry_type IN ('provider_earn','platform_fee')`,
        [jobId],
      )
      const unspent = Math.max(0, num(job.reward_bid_myc) - num(paidRow?.p))
      if (unspent > 0) {
        await tx.query(
          `INSERT INTO ledger_entries(account_id,job_id,amount_myc,entry_type,idempotency_key)
           VALUES ($1,$2,$3,'refund',$4)`,
          [job.requester_id, jobId, unspent, `t-refund-${jobId}`],
        )
        await tx.query(
          `UPDATE account_balance SET available_myc = available_myc + $1, reserved_myc = GREATEST(0, reserved_myc - $1), updated_at=now() WHERE account_id=$2`,
          [unspent, job.requester_id],
        )
      }
    } else {
      await createRound(tx, jobId, roundIndex + 1, nextRef)
    }
  })

  // a small directional-agreement signal for the log (roadmap verification flavor)
  const dir = cosine(
    locals[0].theta.map((v, i) => v - globalBefore[i]),
    next.map((v, i) => v - globalBefore[i]),
  )
  await logEvent("round-aggregated", "aggregator", `${job.name} · round ${roundIndex} → val_loss ${valLoss.toFixed(4)} (dir ${dir.toFixed(2)})`)
  return true
}

/**
 * Bounded-staleness flush (ML_LAYER §4): if a round has no cells left to claim
 * but hasn't reached quorum (e.g. a node dropped or a delta was rejected),
 * aggregate with the accepted deltas we have rather than stalling.
 */
export async function flushStalledRounds(): Promise<void> {
  const stalled = await query<{ round_id: string; job_id: string }>(
    `SELECT r.id AS round_id, r.job_id FROM training_rounds r
     JOIN training_jobs j ON j.id = r.job_id
     WHERE r.status='dispatched' AND j.status='running'
       AND NOT EXISTS (SELECT 1 FROM cells c WHERE c.round_id=r.id AND c.status='forming')`,
  )
  for (const s of stalled) {
    const acc = await queryOne<{ n: number }>(
      `SELECT count(*)::int AS n FROM contributions WHERE round_id=$1 AND accepted=true`, [s.round_id])
    if (acc && acc.n > 0) await aggregateRound(s.job_id, s.round_id)
  }
}

// ---- read: active training job for the dashboard --------------------------

export async function getActiveTraining() {
  const job = await queryOne<{
    id: string; name: string; base_model_ref: string; lora_config: { rank: number }; current_round: number; max_rounds: number; val_loss: string | null; status: string; reward_bid_myc: string
  }>(
    `SELECT id,name,base_model_ref,lora_config,current_round,max_rounds,val_loss,status,reward_bid_myc
     FROM training_jobs ORDER BY (status='running') DESC, created_at DESC LIMIT 1`,
  )
  if (!job) return null
  const lossHistory = await query<{ round_index: number; val_loss: string | null }>(
    `SELECT round_index, val_loss FROM training_rounds WHERE job_id=$1 AND val_loss IS NOT NULL ORDER BY round_index`, [job.id])
  const contribs = await query<{ node_name: string; tokens: string; reward: string }>(
    `SELECT node_name, sum(tokens_processed)::float8 AS tokens, sum(reward_myc)::float8 AS reward
     FROM contributions WHERE job_id=$1 AND accepted=true GROUP BY node_name ORDER BY tokens DESC LIMIT 8`, [job.id])
  const totalTokens = contribs.reduce((s, c) => s + num(c.tokens), 0) || 1
  const rejected = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM contributions WHERE job_id=$1 AND accepted=false`, [job.id])
  return {
    jobId: job.id,
    name: job.name,
    baseModel: job.base_model_ref,
    rank: job.lora_config?.rank ?? 16,
    round: job.current_round,
    maxRounds: job.max_rounds,
    valLoss: job.val_loss != null ? num(job.val_loss) : null,
    status: job.status,
    rejectedDeltas: rejected?.n ?? 0,
    loss: lossHistory.map((r) => ({ round: r.round_index, loss: r.val_loss != null ? num(r.val_loss) : null })),
    contributions: contribs.map((c) => ({ node: c.node_name, share: num(c.tokens) / totalTokens, reward: Math.round(num(c.reward)) })),
  }
}
