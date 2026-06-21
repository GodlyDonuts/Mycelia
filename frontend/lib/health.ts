// Observability: a ledger reconciliation sweep (PLAN §6 test strategy) + an
// on-stage health snapshot (PLAN §9 health strip). Both read-only.

import { query, queryOne, num } from "./db"

/**
 * Reconciliation sweep — recompute invariants over the ledger and balances and
 * flag any drift:
 *  - no account_balance row may go negative (overdraft safety)
 *  - per job, payouts + refunds must not exceed the escrow that was held
 *    (no money printed from a job's escrow)
 */
export async function getReconciliation() {
  const balances = await query<{ a: string; r: string }>(
    `SELECT available_myc::float8 AS a, reserved_myc::float8 AS r FROM account_balance`,
  )
  let negativeBalances = 0
  for (const b of balances) {
    const a = num(b.a)
    const r = num(b.r)
    if (a < -1e-6 || r < -1e-6 || !Number.isFinite(a) || !Number.isFinite(r)) negativeBalances++
  }

  const jobs = await query<{ held: string; paid: string; refunded: string }>(
    `SELECT
       coalesce(sum(amount_myc) FILTER (WHERE entry_type='escrow_hold'),0)::float8 AS held,
       coalesce(sum(amount_myc) FILTER (WHERE entry_type IN ('provider_earn','platform_fee')),0)::float8 AS paid,
       coalesce(sum(amount_myc) FILTER (WHERE entry_type='refund'),0)::float8 AS refunded
     FROM ledger_entries WHERE job_id IS NOT NULL GROUP BY job_id`,
  )
  let overspentJobs = 0
  for (const j of jobs) {
    if (num(j.paid) + num(j.refunded) > Math.abs(num(j.held)) + 0.01) overspentJobs++
  }

  return {
    accountsChecked: balances.length,
    negativeBalances,
    jobsChecked: jobs.length,
    overspentJobs,
    ok: negativeBalances === 0 && overspentJobs === 0,
  }
}

/** On-stage health snapshot — what we watch live so we can see trouble, not guess. */
export async function getHealth() {
  const renderJob = await queryOne<{ id: string; name: string; total_tiles: number; completed_tiles: number; status: string }>(
    `SELECT id, name, total_tiles, completed_tiles, status FROM jobs
     WHERE type='render' ORDER BY (status='running') DESC, created_at DESC LIMIT 1`,
  )
  let tilesByStatus: Record<string, number> = {}
  if (renderJob) {
    const rows = await query<{ status: string; n: number }>(
      `SELECT status, count(*)::int AS n FROM tiles WHERE job_id=$1 GROUP BY status`, [renderJob.id])
    tilesByStatus = Object.fromEntries(rows.map((r) => [r.status, r.n]))
  }

  const training = await queryOne<{ name: string; current_round: number; max_rounds: number; val_loss: string | null; status: string }>(
    `SELECT name, current_round, max_rounds, val_loss, status FROM training_jobs ORDER BY (status='running') DESC, created_at DESC LIMIT 1`,
  )

  const mesh = await queryOne<{ online: number; stale: number; real: number }>(
    `SELECT
       count(*) FILTER (WHERE status<>'offline')::int AS online,
       count(*) FILTER (WHERE status<>'offline' AND is_simulated=false AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - interval '45 seconds'))::int AS stale,
       count(*) FILTER (WHERE is_simulated=false)::int AS real
     FROM nodes`,
  )

  // real (non-simulated) workers + their heartbeat age, for the per-worker strip
  const workers = await query<{ display_name: string; status: string; secs: string | null }>(
    `SELECT display_name, status, EXTRACT(EPOCH FROM (now() - last_heartbeat_at))::float8 AS secs
     FROM nodes WHERE is_simulated=false ORDER BY last_heartbeat_at DESC NULLS LAST LIMIT 10`,
  )

  const trust = await queryOne<{ caught: number; slashed: string }>(
    `SELECT coalesce(sum(challenges_failed),0)::int AS caught,
       (SELECT abs(coalesce(sum(amount_myc),0))::float8 FROM ledger_entries WHERE entry_type='slash') AS slashed
     FROM nodes`,
  )
  const rejects = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM net_events WHERE kind IN ('slash','tile-rejected','delta-rejected') AND created_at > now() - interval '5 minutes'`,
  )

  const recon = await getReconciliation()

  return {
    render: renderJob
      ? { name: renderJob.name, status: renderJob.status, completed: renderJob.completed_tiles, total: renderJob.total_tiles, tilesByStatus }
      : null,
    training: training
      ? { name: training.name, round: training.current_round, maxRounds: training.max_rounds, valLoss: training.val_loss != null ? num(training.val_loss) : null, status: training.status }
      : null,
    mesh: { online: mesh?.online ?? 0, stale: mesh?.stale ?? 0, real: mesh?.real ?? 0 },
    trust: { cheatsCaught: trust?.caught ?? 0, totalSlashed: Math.round(num(trust?.slashed)), rejectsLast5m: rejects?.n ?? 0 },
    reconciliation: recon,
    workers: workers.map((w) => ({
      name: w.display_name,
      status: w.status,
      heartbeatAgeSec: w.secs != null ? Math.round(num(w.secs)) : null,
    })),
  }
}
