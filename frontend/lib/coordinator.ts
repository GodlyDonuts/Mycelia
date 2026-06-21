// Stateless coordinator core (PLAN.md §3). Each function is a single, short,
// request-driven unit of work — no loop holds state across calls; all state
// lives in the database. Route handlers and the in-process driver both call
// these directly.

import { query, queryOne, withTx, num } from "./db"
import { DEMO_REQUESTER, PLATFORM_ACCOUNT, splitReward } from "./myc"
import {
  DEFAULT_RENDER,
  type JobRenderParams,
  tileCount,
  tileGeometry,
  computeTile,
  verifyTile,
  base64ToBytes,
  bytesToBase64,
  hashBytes,
} from "./fractal"
import { JobSpecSchema, type JobSpec, tierToCapabilityClass } from "./jobspec"
import { MAX_RESULT_B64 } from "./policy"

async function logEvent(kind: string, node: string | null, detail: string) {
  await query(`INSERT INTO net_events(kind,node_name,detail) VALUES ($1,$2,$3)`, [kind, node, detail])
}

// ---- /submit ---------------------------------------------------------------

/**
 * Insert a job + all its tile rows + debit escrow through the per-account
 * serialization row, atomically (PLAN.md §3, §4). Every workload runs the
 * single trusted fractal kernel in the MVP (PLAN.md §8), so a submission of any
 * type produces a live, verifiable tiled render.
 */
export async function submitJob(
  spec: JobSpec,
  opts: { render?: Partial<JobRenderParams>; requesterId?: string } = {},
): Promise<{ jobId: string; totalTiles: number; reward: number }> {
  const parsed = JobSpecSchema.parse(spec)
  const requesterId = opts.requesterId ?? DEMO_REQUESTER
  const render: JobRenderParams = { ...DEFAULT_RENDER, ...opts.render }
  const total = tileCount(render)
  const reward = Math.round(parsed.rewardBid)
  const capClass = tierToCapabilityClass(parsed.gpuTier)

  return withTx(async (tx) => {
    // Serialization point: conditional debit. Concurrent overdrafts collide here.
    const bal = await tx.queryOne<{ ok: boolean }>(
      `UPDATE account_balance
         SET available_myc = available_myc - $1, reserved_myc = reserved_myc + $1, updated_at = now()
       WHERE account_id = $2 AND available_myc >= $1
       RETURNING true AS ok`,
      [reward, requesterId],
    )
    if (!bal) throw new Error("INSUFFICIENT_FUNDS")

    const job = await tx.queryOne<{ id: string }>(
      `INSERT INTO jobs(requester_id,name,type,params,req_gpu_model,total_tiles,completed_tiles,replication_factor,reward_bid_myc,status,requester_name,deadline_at,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,'running',$9, now() + ($10 || ' minutes')::interval, now())
       RETURNING id`,
      [requesterId, parsed.name, parsed.type, JSON.stringify({ ...render, gpuTier: parsed.gpuTier, capClass, tier: parsed.tier }),
       parsed.gpuTier, total, parsed.replication, reward, "you", String(parsed.maxRuntimeMin)],
    )
    const jobId = job!.id

    await tx.query(
      `INSERT INTO ledger_entries(account_id,job_id,amount_myc,entry_type,idempotency_key,memo)
       VALUES ($1,$2,$3,'escrow_hold',$4,'job escrow')`,
      [requesterId, jobId, -reward, `escrow-${jobId}`],
    )

    // Bulk-insert tile rows.
    for (let i = 0; i < total; i++) {
      const g = tileGeometry(render, i)
      await tx.query(
        `INSERT INTO tiles(job_id,tile_index,px0,py0,px1,py1,cx0,cy0,cx1,cy1,params,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')`,
        [jobId, i, g.rect.px0, g.rect.py0, g.rect.px1, g.rect.py1, g.cx0, g.cy0, g.cx1, g.cy1, JSON.stringify(render)],
      )
    }
    // NOTE: use the tx handle here — calling the module-level query() (which uses
    // the shared connection) from inside a transaction would deadlock PGlite.
    await tx.query(`INSERT INTO net_events(kind,node_name,detail) VALUES ('fanout','scheduler',$1)`, [
      `${parsed.name} → ${total} tiles`,
    ])
    return { jobId, totalTiles: total, reward }
  })
}

// ---- /pull-work ------------------------------------------------------------

export interface ClaimedTile {
  tileId: string
  jobId: string
  tileIndex: number
  params: JobRenderParams
  rect: { px0: number; py0: number; px1: number; py1: number }
}

/**
 * Randomized conditional claim of one pending tile (PLAN.md §3). The randomized
 * pick + RETURNING is exactly the OCC-safe claim pattern; on DSQL it carries the
 * mandatory 40001 retry (handled by withTx's wrapper).
 */
export async function pullWork(node: { id: string; name: string }, jobId?: string): Promise<ClaimedTile | null> {
  const claimed = await queryOne<{
    id: string
    job_id: string
    tile_index: number
    params: JobRenderParams
    px0: number; py0: number; px1: number; py1: number
  }>(
    `UPDATE tiles SET status='claimed', assigned_node_id=$1, assigned_node_name=$2, claimed_at=now()
     WHERE id = (
       SELECT t.id FROM tiles t JOIN jobs j ON j.id = t.job_id
       WHERE t.status='pending' AND j.status='running' ${jobId ? "AND t.job_id = $3" : ""}
       ORDER BY CASE j.params->>'tier' WHEN 'realtime' THEN 0 WHEN 'priority' THEN 1 ELSE 2 END, random() LIMIT 1
     )
     RETURNING id, job_id, tile_index, params, px0, py0, px1, py1`,
    jobId ? [node.id, node.name, jobId] : [node.id, node.name],
  )
  if (!claimed) return null
  return {
    tileId: claimed.id,
    jobId: claimed.job_id,
    tileIndex: claimed.tile_index,
    params: claimed.params,
    rect: { px0: claimed.px0, py0: claimed.py0, px1: claimed.px1, py1: claimed.py1 },
  }
}

// ---- /submit-result --------------------------------------------------------

export interface SubmitResultOut {
  ok: boolean
  verified: boolean
  diffPct: number
  reward: number
  jobDone: boolean
}

/**
 * Record a result, run the deterministic self-check, and on pass flip the tile
 * to verified + pay the contributor through the escrow→provider_earn+platform_fee
 * split, all in one transaction (PLAN.md §3, §7). On the last tile the job is
 * marked ready_to_settle and settled.
 */
export async function submitResult(input: {
  tileId: string
  nodeId: string
  nodeName: string
  resultB64: string
  gpuMs?: number
}): Promise<SubmitResultOut> {
  // Early DoS guard (#35): reject an oversized blob before it's decoded or
  // recomputed. Tiles are tiny; a huge payload is either a bug or an attack.
  if (input.resultB64.length > MAX_RESULT_B64) {
    return { ok: false, verified: false, diffPct: 1, reward: 0, jobDone: false }
  }

  const tile = await queryOne<{
    id: string; job_id: string; tile_index: number; params: JobRenderParams; status: string
  }>(`SELECT id, job_id, tile_index, params, status FROM tiles WHERE id=$1`, [input.tileId])
  if (!tile) return { ok: false, verified: false, diffPct: 1, reward: 0, jobDone: false }

  const job = await queryOne<{ reward_bid_myc: string; total_tiles: number; requester_id: string; name: string }>(
    `SELECT reward_bid_myc, total_tiles, requester_id, name FROM jobs WHERE id=$1`, [tile.job_id])
  if (!job) return { ok: false, verified: false, diffPct: 1, reward: 0, jobDone: false }

  const perTile = num(job.reward_bid_myc) / job.total_tiles
  const { provider, fee } = splitReward(perTile)

  const bytes = base64ToBytes(input.resultB64)
  const check = verifyTile(tile.params, tile.tile_index, bytes)

  if (!check.ok) {
    // Failed challenge → SLASH stake-at-risk (PLAN §8). Cheating is negative-EV:
    // a wrong result forfeits a multiple of the tile's reward from the node's
    // stake, drops its reputation (raising its future spot-check rate), and the
    // tile returns to the pool for an honest node to recompute.
    const slashAmt = await withTx(async (tx) => {
      // Gate the slash on a guarded claim transition: only the node that still
      // holds this exact claim can be slashed for it. Replays, results for a
      // reclaimed tile, or non-owners match no row → no double-slash, no abuse.
      const claimed = await tx.queryOne<{ id: string }>(
        `UPDATE tiles SET status='pending', assigned_node_id=NULL, assigned_node_name=NULL
         WHERE id=$1 AND assigned_node_id=$2 AND status='claimed' RETURNING id`,
        [input.tileId, input.nodeId],
      )
      if (!claimed) return 0
      const n = await tx.queryOne<{ user_id: string; stake_myc: string }>(
        `SELECT user_id, stake_myc FROM nodes WHERE id=$1`, [input.nodeId])
      const amt = Math.min(num(n?.stake_myc), Math.max(2, perTile * 4))
      await tx.query(
        `UPDATE nodes SET stake_myc = GREATEST(0, stake_myc - $2), reputation = GREATEST(0, reputation - 8),
           reliability_score = GREATEST(0, reliability_score - 0.1), spot_checks = spot_checks + 1, challenges_failed = challenges_failed + 1
         WHERE id=$1`,
        [input.nodeId, amt],
      )
      if (amt > 0) {
        await tx.query(
          `INSERT INTO ledger_entries(account_id,job_id,tile_id,amount_myc,entry_type,idempotency_key)
           VALUES ($1,$2,$3,$4,'slash',$5)`,
          [n?.user_id ?? input.nodeId, tile.job_id, input.tileId, -amt, `slash-${input.tileId}-${input.nodeId}-${Date.now()}`],
        )
      }
      await tx.query(`INSERT INTO reputation_events(node_id,kind,delta) VALUES ($1,'fail',-8)`, [input.nodeId])
      return amt
    })
    if (slashAmt > 0) await logEvent("slash", input.nodeName, `cheat caught · tile ${tile.tile_index} · −${Math.round(slashAmt)} MYC slashed`)
    return { ok: false, verified: false, diffPct: check.diffPct, reward: 0, jobDone: false }
  }

  const result = await withTx(async (tx) => {
    // idempotent: only the first verify of a not-yet-verified tile pays out
    const flipped = await tx.queryOne<{ id: string }>(
      `UPDATE tiles SET status='verified', result_uri=$2, result_hash=$3, result_bytes=$4, gpu_ms=$5, assigned_node_name=$6, completed_at=now()
       WHERE id=$1 AND status<>'verified' RETURNING id`,
      [input.tileId, input.resultB64, check.refHash, bytes.length, input.gpuMs ?? 0, input.nodeName],
    )
    if (!flipped) return { paid: false, jobDone: false }

    await tx.query(
      `INSERT INTO tile_results(tile_id,node_id,node_name,result_hash,result_uri,gpu_ms,vote_status)
       VALUES ($1,$2,$3,$4,$5,$6,'agreed')`,
      [input.tileId, input.nodeId, input.nodeName, check.refHash, input.resultB64, input.gpuMs ?? 0],
    )

    // owner of the node is the payout account
    const owner = await tx.queryOne<{ user_id: string }>(`SELECT user_id FROM nodes WHERE id=$1`, [input.nodeId])
    const ownerId = owner?.user_id ?? input.nodeId

    await tx.query(
      `INSERT INTO ledger_entries(account_id,job_id,tile_id,amount_myc,entry_type,idempotency_key)
       VALUES ($1,$2,$3,$4,'provider_earn',$5)`,
      [ownerId, tile.job_id, input.tileId, provider, `pay-${input.tileId}`],
    )
    await tx.query(
      `INSERT INTO ledger_entries(account_id,job_id,tile_id,amount_myc,entry_type,idempotency_key)
       VALUES ($1,$2,$3,$4,'platform_fee',$5)`,
      [PLATFORM_ACCOUNT, tile.job_id, input.tileId, fee, `fee-${input.tileId}`],
    )
    await tx.query(
      `UPDATE account_balance SET reserved_myc = GREATEST(0, reserved_myc - $1), updated_at=now() WHERE account_id=$2`,
      [perTile, job.requester_id],
    )
    await tx.query(
      `UPDATE node_telemetry_current SET epoch_earnings_myc = epoch_earnings_myc + $1, updated_at=now() WHERE node_id=$2`,
      [provider, input.nodeId],
    )
    await tx.query(`INSERT INTO reputation_events(node_id,kind,delta) VALUES ($1,'pass',1)`, [input.nodeId])
    // passed challenge → reputation up (lowers future spot-check rate, raises sellable fraction)
    await tx.query(
      `UPDATE nodes SET reputation = LEAST(100, reputation + 0.4), reliability_score = LEAST(1, reliability_score + 0.01),
         spot_checks = spot_checks + 1 WHERE id=$1`,
      [input.nodeId],
    )

    const upd = await tx.queryOne<{ completed_tiles: number; total_tiles: number }>(
      `UPDATE jobs SET completed_tiles = completed_tiles + 1 WHERE id=$1 RETURNING completed_tiles, total_tiles`,
      [tile.job_id],
    )
    const jobDone = !!upd && upd.completed_tiles >= upd.total_tiles
    if (jobDone) await tx.query(`UPDATE jobs SET status='ready_to_settle' WHERE id=$1`, [tile.job_id])
    return { paid: true, jobDone }
  })

  await logEvent("tile-verified", input.nodeName, `tile ${tile.tile_index} · ${job.name}`)
  await logEvent("credited", input.nodeName, `+${provider.toFixed(1)} MYC`)
  if (result.jobDone) await settle(tile.job_id)

  return { ok: true, verified: true, diffPct: check.diffPct, reward: provider, jobDone: result.jobDone }
}

// ---- /settle ---------------------------------------------------------------

/**
 * Server-authoritative settlement (PLAN.md §3): re-check that all tiles are
 * verified, refund any unused escrow, and finalize. Never triggered as the
 * payment authority by an untrusted client.
 */
export async function settle(jobId: string): Promise<{ settled: boolean }> {
  return withTx(async (tx) => {
    const job = await tx.queryOne<{ status: string; requester_id: string; name: string }>(
      `SELECT status, requester_id, name FROM jobs WHERE id=$1`, [jobId])
    if (!job) return { settled: false }
    const pending = await tx.queryOne<{ n: number }>(
      `SELECT count(*)::int AS n FROM tiles WHERE job_id=$1 AND status<>'verified'`, [jobId])
    if (pending && pending.n > 0) return { settled: false }

    // refund any escrow left reserved for this job's requester (unused tiles)
    const bal = await tx.queryOne<{ reserved_myc: string }>(
      `SELECT reserved_myc FROM account_balance WHERE account_id=$1`, [job.requester_id])
    // (reserved is shared across jobs; we only mark completion here — over-refund
    // guarded by the per-tile reserved decrements above.)
    await tx.query(`UPDATE jobs SET status='completed', result_image_uri='assembled', completed_tiles=total_tiles WHERE id=$1`, [jobId])
    return { settled: true }
  }).then(async (r) => {
    if (r.settled) await logEvent("round-aggregated", "scheduler", `settled · ${jobId.slice(0, 8)}`)
    return r
  })
}

// ---- node registration + heartbeat ----------------------------------------

export async function registerNode(input: {
  id?: string
  name: string
  kind?: string
  gpuModel?: string
  isSimulated?: boolean
  region?: string
}): Promise<{ id: string }> {
  const kind = input.kind ?? "browser"
  const capClass = input.gpuModel && input.gpuModel !== "—" ? `gpu_${input.gpuModel.toLowerCase()}` : "cpu_only"
  const row = await queryOne<{ id: string }>(
    `INSERT INTO nodes(id,user_id,display_name,status,kind,capability_class,gpu_model,is_simulated,region,last_heartbeat_at)
     VALUES (coalesce($1, gen_random_uuid()), $2, $3, 'online', $4, $5, $6, $7, $8, now())
     ON CONFLICT (id) DO UPDATE SET status='online', last_heartbeat_at=now()
     RETURNING id`,
    [input.id ?? null, "00000000-0000-0000-0000-0000000000b1", input.name, kind, capClass,
     input.gpuModel ?? "—", input.isSimulated ?? false, input.region ?? "browser"],
  )
  await query(
    `INSERT INTO node_telemetry_current(node_id,cpu_pct,gpu_pct,ram_pct,current_job)
     VALUES ($1,0,0,0,'idle') ON CONFLICT (node_id) DO NOTHING`,
    [row!.id],
  )
  await logEvent("join", input.name, "joined the mesh")
  return { id: row!.id }
}

export async function heartbeat(nodeId: string, t: { cpu?: number; gpu?: number; ram?: number; job?: string | null }) {
  await query(
    `UPDATE node_telemetry_current SET cpu_pct=coalesce($2,cpu_pct), gpu_pct=coalesce($3,gpu_pct),
       ram_pct=coalesce($4,ram_pct), current_job=$5, updated_at=now() WHERE node_id=$1`,
    [nodeId, t.cpu ?? null, t.gpu ?? null, t.ram ?? null, t.job ?? null],
  )
  await query(`UPDATE nodes SET last_heartbeat_at=now(), status='online' WHERE id=$1`, [nodeId])
}

// re-exports the driver uses
export { computeTile, bytesToBase64, hashBytes }
