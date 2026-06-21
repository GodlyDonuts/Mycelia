// Read-only MCP tools over the live mesh (PLAN.md §3 "the compute mesh is
// wrapped as a read-only MCP server"). The agent may READ the mesh, inspect job
// progress, and explain a settlement — it can never authorize a payment; /settle
// is deliberately not exposed.

import { query, queryOne, num } from "./db"
import { getNetwork } from "./reads"

export const TOOLS = [
  {
    name: "get_mesh_status",
    description: "Live aggregate status of the Mycelia compute mesh: nodes/GPUs online, network TFLOP/s, jobs running, total MYC credited, and the active render's progress.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_nodes",
    description: "List currently online nodes in the mesh with their kind, GPU, load, and earnings this epoch.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", description: "max nodes to return (default 10)" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_job_progress",
    description: "Progress of a job by id, or the active render if no id is given: tiles verified vs total, status, and reward.",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string", description: "optional job UUID" } },
      additionalProperties: false,
    },
  },
  {
    name: "explain_settlement",
    description: "Explain a job's escrow-until-verified settlement in plain English: escrow held, paid to providers, platform fee, and tiles verified. Read-only — cannot authorize payment.",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string", description: "optional job UUID; defaults to the most recent job" } },
      additionalProperties: false,
    },
  },
] as const

export async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "get_mesh_status":
      return getMeshStatus()
    case "list_nodes":
      return listNodes(typeof args.limit === "number" ? args.limit : 10)
    case "get_job_progress":
      return getJobProgress(typeof args.jobId === "string" ? args.jobId : undefined)
    case "explain_settlement":
      return explainSettlement(typeof args.jobId === "string" ? args.jobId : undefined)
    default:
      throw new Error(`unknown tool: ${name}`)
  }
}

async function getMeshStatus(): Promise<string> {
  const n = await getNetwork()
  const render = await queryOne<{ name: string; completed_tiles: number; total_tiles: number; status: string }>(
    `SELECT name, completed_tiles, total_tiles, status FROM jobs WHERE type='render' ORDER BY (status='running') DESC, created_at DESC LIMIT 1`,
  )
  const c = n.cluster
  const lines = [
    `Mycelia mesh status:`,
    `• ${c.nodesOnline} nodes online (${c.gpusOnline} with GPUs)`,
    `• ${c.tflops.toLocaleString()} TFLOP/s aggregate, ${c.throughput} GB/s throughput`,
    `• ${c.jobsRunning} jobs running, ${c.jobsQueued} queued`,
    `• ${n.creditedMyc.toLocaleString()} MYC credited to contributors so far`,
    `• cluster utilization ~${n.utilization}%`,
  ]
  if (render) lines.push(`• active render "${render.name}": ${render.completed_tiles}/${render.total_tiles} tiles (${render.status})`)
  return lines.join("\n")
}

async function listNodes(limit: number): Promise<string> {
  const rows = await query<{ display_name: string; kind: string; gpu_model: string; gpu_pct: string; epoch_earnings_myc: string }>(
    `SELECT n.display_name, n.kind, n.gpu_model, coalesce(t.gpu_pct,0) AS gpu_pct, coalesce(t.epoch_earnings_myc,0) AS epoch_earnings_myc
     FROM nodes n LEFT JOIN node_telemetry_current t ON t.node_id=n.id
     WHERE n.status='online' ORDER BY n.is_simulated ASC, t.epoch_earnings_myc DESC NULLS LAST LIMIT $1`,
    [Math.max(1, Math.min(50, limit))],
  )
  if (!rows.length) return "No nodes online."
  return rows
    .map((r) => `• ${r.display_name} [${r.kind}${r.gpu_model && r.gpu_model !== "—" ? " · " + r.gpu_model : ""}] — load ${Math.round(num(r.gpu_pct))}%, earned ${Math.round(num(r.epoch_earnings_myc))} MYC this epoch`)
    .join("\n")
}

async function getJobProgress(jobId?: string): Promise<string> {
  const job = jobId
    ? await queryOne<{ id: string; name: string; type: string; total_tiles: number; completed_tiles: number; status: string; reward_bid_myc: string }>(
        `SELECT id,name,type,total_tiles,completed_tiles,status,reward_bid_myc FROM jobs WHERE id=$1`, [jobId])
    : await queryOne<{ id: string; name: string; type: string; total_tiles: number; completed_tiles: number; status: string; reward_bid_myc: string }>(
        `SELECT id,name,type,total_tiles,completed_tiles,status,reward_bid_myc FROM jobs WHERE type='render' ORDER BY (status='running') DESC, created_at DESC LIMIT 1`)
  if (!job) return "No matching job."
  const pct = job.total_tiles ? Math.round((job.completed_tiles / job.total_tiles) * 100) : 0
  return `Job "${job.name}" (${job.type}, ${job.id.slice(0, 8)}): ${job.completed_tiles}/${job.total_tiles} tiles verified (${pct}%), status=${job.status}, reward=${Math.round(num(job.reward_bid_myc))} MYC.`
}

async function explainSettlement(jobId?: string): Promise<string> {
  const job = jobId
    ? await queryOne<{ id: string; name: string; status: string; total_tiles: number; completed_tiles: number }>(
        `SELECT id,name,status,total_tiles,completed_tiles FROM jobs WHERE id=$1`, [jobId])
    : await queryOne<{ id: string; name: string; status: string; total_tiles: number; completed_tiles: number }>(
        `SELECT id,name,status,total_tiles,completed_tiles FROM jobs ORDER BY created_at DESC LIMIT 1`)
  if (!job) return "No matching job."
  const led = await queryOne<{ escrow: string; earn: string; fee: string }>(
    `SELECT
       coalesce(sum(amount_myc) FILTER (WHERE entry_type='escrow_hold'),0)::float8 AS escrow,
       coalesce(sum(amount_myc) FILTER (WHERE entry_type='provider_earn'),0)::float8 AS earn,
       coalesce(sum(amount_myc) FILTER (WHERE entry_type='platform_fee'),0)::float8 AS fee
     FROM ledger_entries WHERE job_id=$1`,
    [job.id],
  )
  const escrow = Math.abs(Math.round(num(led?.escrow)))
  const earn = Math.round(num(led?.earn))
  const fee = Math.round(num(led?.fee))
  return [
    `Settlement for "${job.name}" (${job.id.slice(0, 8)}), status=${job.status}:`,
    `• ${escrow} MYC was held in escrow at submit (debited from the requester through the per-account serialization row).`,
    `• As each of ${job.completed_tiles}/${job.total_tiles} tiles passed the deterministic self-check, escrow was released: ${earn} MYC paid to contributors and ${fee} MYC platform fee.`,
    `• This is escrow-until-verified: contributors are paid only for verified tiles; unused escrow is refunded on settlement.`,
    `• Note: this endpoint is read-only — an agent can explain settlement but can never authorize it.`,
  ].join("\n")
}
