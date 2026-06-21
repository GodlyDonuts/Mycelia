// Read-path queries that back the live screens. All run strongly-consistent
// against the one shared connection (PLAN.md §3 "the entire read path talks
// directly to one cluster").

import { query, queryOne, num } from "./db"
import { DEMO_USER } from "./myc"

const DEVICE = (kind: string) => (kind === "browser" ? "laptop" : kind)

// ---- Dashboard -------------------------------------------------------------

export async function getDashboard() {
  const earn = await queryOne<{ s: string }>(
    `SELECT coalesce(sum(amount_myc),0)::float8 AS s FROM ledger_entries WHERE account_id=$1 AND entry_type='provider_earn'`,
    [DEMO_USER],
  )
  const totalEarnings = Math.round(num(earn?.s))

  const nodes = await query<{
    id: string; display_name: string; kind: string; status: string; region: string
    cpu_pct: string; gpu_pct: string; ram_pct: string; current_job: string | null
    job_progress: string; epoch_earnings_myc: string
  }>(
    `SELECT n.id, n.display_name, n.kind, n.status, n.region,
            t.cpu_pct, t.gpu_pct, t.ram_pct, t.current_job, t.job_progress, t.epoch_earnings_myc
     FROM nodes n JOIN node_telemetry_current t ON t.node_id = n.id
     WHERE n.user_id=$1 AND n.is_simulated=false
     ORDER BY n.registered_at`,
    [DEMO_USER],
  )
  const nodeData = nodes.map((n) => ({
    id: n.id,
    name: n.display_name,
    type: DEVICE(n.kind),
    status: n.status,
    cpu: Math.round(num(n.cpu_pct)),
    gpu: Math.round(num(n.gpu_pct)),
    ram: Math.round(num(n.ram_pct)),
    job: n.current_job && n.current_job !== "idle"
      ? { name: n.current_job, progress: Math.round(num(n.job_progress)) }
      : null,
    epochEarnings: Math.round(num(n.epoch_earnings_myc) * 10) / 10,
    location: n.region,
  }))

  const active = nodeData.filter((n) => n.status !== "offline").length
  const events = await recentEvents(8)

  return {
    totalEarnings,
    totalEarningsUsd: Math.round(totalEarnings * 0.12),
    activeNodes: active,
    enrolledNodes: nodeData.length,
    nodes: nodeData,
    events,
  }
}

// ---- Network / telemetry ---------------------------------------------------

export async function getNetwork() {
  const agg = await queryOne<{
    nodes_online: number; gpus_online: number; tflops: string; throughput: string
  }>(
    `SELECT
       count(*) FILTER (WHERE status IN ('online','idle'))::int AS nodes_online,
       count(*) FILTER (WHERE status IN ('online','idle') AND gpu_model <> '—')::int AS gpus_online,
       (count(*) FILTER (WHERE status='online') * 41.3)::float8 AS tflops,
       (coalesce(avg(t.throughput_mbps),0)/1000.0 * count(*) FILTER (WHERE status='online'))::float8 AS throughput
     FROM nodes n LEFT JOIN node_telemetry_current t ON t.node_id=n.id`,
  )
  const jobs = await queryOne<{ running: number; queued: number }>(
    `SELECT count(*) FILTER (WHERE status IN ('running','ready_to_settle'))::int AS running,
            count(*) FILTER (WHERE status='queued')::int AS queued FROM jobs`,
  )
  const util = await queryOne<{ u: string }>(
    `SELECT coalesce(avg(gpu_pct),0)::float8 AS u FROM node_telemetry_current t JOIN nodes n ON n.id=t.node_id WHERE n.status='online'`,
  )
  const credited = await queryOne<{ s: string }>(
    `SELECT coalesce(sum(amount_myc),0)::float8 AS s FROM ledger_entries WHERE entry_type='provider_earn'`,
  )

  // graph sample: hub + ring of the strongest online nodes
  const sample = await query<{ id: string; display_name: string; kind: string; gpu_model: string; cap: string; load: string; job: string | null }>(
    `SELECT n.id, n.display_name, n.kind, n.gpu_model,
            coalesce((n.capability->>'cap')::float8, 0.5) AS cap,
            (coalesce(t.gpu_pct,40)/100.0) AS load, t.current_job AS job
     FROM nodes n LEFT JOIN node_telemetry_current t ON t.node_id=n.id
     WHERE n.status='online'
     ORDER BY n.is_simulated ASC, n.reputation DESC, n.id LIMIT 13`,
  )
  const graphNodes = sample.map((n, i) => {
    const angle = (i / Math.max(1, sample.length)) * Math.PI * 2
    const ring = i % 3 === 0 ? 0.18 : i % 3 === 1 ? 0.34 : 0.46
    const isHub = i === 0
    return {
      id: n.id,
      label: n.display_name,
      kind: (n.kind === "browser" ? "laptop" : n.kind) as "gpu" | "desktop" | "laptop" | "phone",
      capacity: isHub ? 1 : 0.35 + num(n.cap) * 0.6,
      load: Math.max(0.1, Math.min(1, num(n.load))),
      gpu: n.gpu_model,
      job: n.job && n.job !== "idle" ? n.job : null,
      x: isHub ? 0.5 : 0.5 + Math.cos(angle) * ring,
      y: isHub ? 0.5 : 0.5 + Math.sin(angle) * ring,
    }
  })
  const hub = graphNodes[0]?.id
  const links = hub
    ? graphNodes.slice(1).map((n, i) => ({ source: hub, target: n.id, flow: 0.3 + ((i * 7) % 60) / 100 }))
    : []

  return {
    cluster: {
      nodesOnline: agg?.nodes_online ?? 0,
      gpusOnline: agg?.gpus_online ?? 0,
      tflops: Math.round(num(agg?.tflops)),
      throughput: Math.round(num(agg?.throughput) * 10) / 10,
      jobsRunning: jobs?.running ?? 0,
      jobsQueued: jobs?.queued ?? 0,
    },
    utilization: Math.round(num(util?.u)),
    creditedMyc: Math.round(num(credited?.s)),
    graphNodes,
    links,
    events: await recentEvents(12),
  }
}

// ---- Active render (live reassembly) ---------------------------------------

export async function getActiveRender() {
  const job = await queryOne<{ id: string; name: string; params: { width: number; height: number; tilePx: number }; total_tiles: number; completed_tiles: number; status: string }>(
    `SELECT id, name, params, total_tiles, completed_tiles, status FROM jobs
     WHERE type='render' AND status IN ('running','ready_to_settle','completed')
     ORDER BY (status='running') DESC, created_at DESC LIMIT 1`,
  )
  if (!job) return null
  const tiles = await query<{
    tile_index: number; status: string; assigned_node_name: string | null; gpu_ms: string; result_uri: string | null; px0: number; py0: number; px1: number; py1: number
  }>(
    `SELECT tile_index, status, assigned_node_name, gpu_ms, result_uri, px0, py0, px1, py1
     FROM tiles WHERE job_id=$1 ORDER BY tile_index`,
    [job.id],
  )
  const p = job.params
  return {
    jobId: job.id,
    name: job.name,
    width: p.width,
    height: p.height,
    tilePx: p.tilePx,
    cols: p.width / p.tilePx,
    total: job.total_tiles,
    completed: job.completed_tiles,
    status: job.status,
    tiles: tiles.map((t) => ({
      index: t.tile_index,
      state: t.status === "verified" ? "done" : t.status === "claimed" || t.status === "submitted" ? "computing" : "pending",
      node: t.assigned_node_name ?? "—",
      gpuMs: Math.round(num(t.gpu_ms)),
      px0: t.px0, py0: t.py0, px1: t.px1, py1: t.py1,
      // pixel bytes only for finished tiles, so the client reassembles real output
      b64: t.status === "verified" ? t.result_uri : null,
    })),
  }
}

// ---- Marketplace -----------------------------------------------------------

export async function getMarketplace() {
  const listings = await query<{
    id: string; name: string; type: string; req_gpu_model: string | null; params: { vram?: number; ram?: number } | null
    reward_bid_myc: string; total_tiles: number; completed_tiles: number; status: string; replication_factor: number
    requester_name: string | null; deadline_at: string | null
  }>(
    `SELECT id,name,type,req_gpu_model,params,reward_bid_myc,total_tiles,completed_tiles,status,replication_factor,requester_name,deadline_at
     FROM jobs ORDER BY created_at DESC LIMIT 24`,
  )
  const market = await queryOne<{ supply_units: string; demand_units: string; clearing_price_myc: string }>(
    `SELECT supply_units, demand_units, clearing_price_myc FROM market_snapshots ORDER BY captured_at DESC LIMIT 1`,
  )
  const mapStatus = (s: string) =>
    s === "completed" ? "completed" : s === "queued" ? "queued" : s === "running" || s === "ready_to_settle" ? "running" : "open"
  return {
    listings: listings.map((j) => ({
      id: j.id,
      name: j.name,
      type: (["render", "inference", "sim", "lora"].includes(j.type) ? j.type : "render") as "render" | "inference" | "sim" | "lora",
      gpuTier: (j.req_gpu_model ?? "4090") as string,
      vram: j.params?.vram ?? 24,
      ram: j.params?.ram ?? 64,
      reward: Math.round(num(j.reward_bid_myc)),
      deadline: j.deadline_at ?? new Date(Date.now() + 6 * 3600_000).toISOString(),
      tilesDone: j.completed_tiles,
      tilesTotal: j.total_tiles,
      status: mapStatus(j.status),
      replication: j.replication_factor,
      requester: j.requester_name ?? "mycelia",
    })),
    market: {
      supply: Math.round(num(market?.supply_units)),
      demand: Math.round(num(market?.demand_units)),
      clearingPrice: num(market?.clearing_price_myc) || 0.12,
    },
  }
}

// ---- Landing stats ---------------------------------------------------------

export async function getStats() {
  const n = await getNetwork()
  return {
    nodesOnline: n.cluster.nodesOnline,
    gpusOnline: n.cluster.gpusOnline,
    tflops: n.cluster.tflops,
    jobsRunning: n.cluster.jobsRunning,
    creditedMyc: n.creditedMyc,
  }
}

// ---- Ledger / settlement ---------------------------------------------------

export async function getLedger() {
  const acct = async (id: string) => {
    const sum = await queryOne<{ s: string }>(
      `SELECT coalesce(sum(amount_myc),0)::float8 AS s FROM ledger_entries WHERE account_id=$1`, [id])
    const bal = await queryOne<{ available_myc: string; reserved_myc: string }>(
      `SELECT available_myc, reserved_myc FROM account_balance WHERE account_id=$1`, [id])
    return {
      ledgerSum: Math.round(num(sum?.s)),
      available: bal ? Math.round(num(bal.available_myc)) : null,
      reserved: bal ? Math.round(num(bal.reserved_myc)) : null,
    }
  }
  const totals = await queryOne<{ escrow: string; earn: string; fee: string; refund: string; entries: number }>(
    `SELECT
       coalesce(sum(amount_myc) FILTER (WHERE entry_type='escrow_hold'),0)::float8 AS escrow,
       coalesce(sum(amount_myc) FILTER (WHERE entry_type='provider_earn'),0)::float8 AS earn,
       coalesce(sum(amount_myc) FILTER (WHERE entry_type='platform_fee'),0)::float8 AS fee,
       coalesce(sum(amount_myc) FILTER (WHERE entry_type='refund'),0)::float8 AS refund,
       count(*)::int AS entries
     FROM ledger_entries`,
  )
  const recent = await query<{ entry_type: string; amount_myc: string; memo: string | null; created_at: string }>(
    `SELECT entry_type, amount_myc::float8 AS amount_myc, memo, created_at FROM ledger_entries
     WHERE idempotency_key NOT LIKE 'seed-%' ORDER BY created_at DESC LIMIT 24`,
  )
  return {
    requester: await acct("00000000-0000-0000-0000-0000000000a1"),
    platform: await acct("00000000-0000-0000-0000-0000000000fe"),
    you: await acct(DEMO_USER),
    totals: {
      escrowHeld: Math.round(num(totals?.escrow)),
      paidToProviders: Math.round(num(totals?.earn)),
      platformFees: Math.round(num(totals?.fee)),
      refunded: Math.round(num(totals?.refund)),
      entries: totals?.entries ?? 0,
    },
    recent: recent.map((r) => ({
      type: r.entry_type,
      amount: Math.round(num(r.amount_myc) * 100) / 100,
      memo: r.memo,
      ts: new Date(r.created_at).getTime(),
    })),
  }
}

// ---- shared ----------------------------------------------------------------

async function recentEvents(limit: number) {
  const evs = await query<{ kind: string; node_name: string | null; detail: string; created_at: string }>(
    `SELECT kind, node_name, detail, created_at FROM net_events ORDER BY created_at DESC LIMIT $1`,
    [limit],
  )
  return evs.map((e, i) => ({
    id: `${e.created_at}-${i}`,
    kind: e.kind,
    node: e.node_name ?? "scheduler",
    detail: e.detail,
    ts: new Date(e.created_at).getTime(),
  }))
}
