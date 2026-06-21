// Seeds a populated, believable mesh so every screen paints live on first load
// (PLAN.md §9 resilience kit: "pre-seed tables so the first read returns rows"
// + "pre-seed ~70% of tiles as cached/already-verified").

import type { PGlite } from "@electric-sql/pglite"
import { DEFAULT_RENDER, computeTile, hashBytes, bytesToBase64, tileGeometry, tileCount } from "../fractal"
import { DEMO_REQUESTER, DEMO_USER, PLATFORM_ACCOUNT, splitReward } from "../myc"

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const REGIONS = ["Berlin, DE", "Frankfurt, DE", "Lisbon, PT", "Tokyo, JP", "Austin, US", "Toronto, CA", "Oslo, NO"]
const GPUS = ["H100", "A100", "4090", "A10G", "T4", "3090", "4080", "—"]
const KINDS = ["gpu", "gpu", "desktop", "gpu", "laptop", "desktop", "gpu", "phone"] as const
const SIM_JOBS = [
  "sd-xl-inference",
  "llama-ft-7b · shard 04",
  "render-batch-1182",
  "fractal-deepzoom",
  null,
  "resnet-train-44",
  "sim-fluid-9",
  null,
]

// The 6 "your" nodes mirror the dashboard design.
const VISIBLE = [
  { name: "studio-rig", kind: "gpu", gpu: "4090", region: "Berlin, DE", cpu: 42, gpu_pct: 91, ram: 68, job: "llama-ft-7b · shard 04", prog: 73, earn: 312.4, status: "online" },
  { name: "office-desktop", kind: "desktop", gpu: "3090", region: "Berlin, DE", cpu: 64, gpu_pct: 38, ram: 51, job: "render-batch-1182", prog: 41, earn: 88.2, status: "online" },
  { name: "macbook-pro", kind: "laptop", gpu: "—", region: "Lisbon, PT", cpu: 8, gpu_pct: 3, ram: 22, job: null, prog: 0, earn: 19.6, status: "idle" },
  { name: "render-node-a", kind: "gpu", gpu: "A10G", region: "Frankfurt, DE", cpu: 55, gpu_pct: 84, ram: 77, job: "sd-xl-inference", prog: 92, earn: 241.9, status: "online" },
  { name: "living-room-pc", kind: "desktop", gpu: "4080", region: "Berlin, DE", cpu: 12, gpu_pct: 6, ram: 30, job: null, prog: 0, earn: 7.1, status: "idle" },
  { name: "pixel-9-pro", kind: "phone", gpu: "—", region: "Lisbon, PT", cpu: 0, gpu_pct: 0, ram: 0, job: null, prog: 0, earn: 2.4, status: "offline" },
]

const uuid = (n: number) => `00000000-0000-0000-0000-${(n + 0x100000).toString(16).padStart(12, "0")}`

export async function seed(pg: PGlite): Promise<void> {
  const rnd = mulberry32(20260621)

  // ---- users + accounts ----
  await pg.query(
    `INSERT INTO users(id,email,role,reputation,region) VALUES
       ($1,'requester@mycelia.dev','requester',80,'Berlin, DE'),
       ($2,'you@mycelia.dev','provider',92,'Berlin, DE'),
       ($3,'platform@mycelia.dev','both',100,'—')
     ON CONFLICT (id) DO NOTHING`,
    [DEMO_REQUESTER, DEMO_USER, PLATFORM_ACCOUNT],
  )
  await pg.query(
    `INSERT INTO account_balance(account_id,available_myc,reserved_myc) VALUES
       ($1,200000,0),($2,0,0),($3,0,0)
     ON CONFLICT (account_id) DO NOTHING`,
    [DEMO_REQUESTER, DEMO_USER, PLATFORM_ACCOUNT],
  )

  // ---- visible "your" nodes ----
  const visibleIds: string[] = []
  for (let i = 0; i < VISIBLE.length; i++) {
    const v = VISIBLE[i]
    const id = uuid(i)
    visibleIds.push(id)
    const cap = v.kind === "gpu" ? 0.6 + rnd() * 0.4 : v.kind === "phone" ? 0.15 : 0.35 + rnd() * 0.2
    await pg.query(
      `INSERT INTO nodes(id,user_id,display_name,status,kind,capability_class,gpu_model,gpu_vram_gb,ram_gb,
         capability,reliability_score,reputation,is_simulated,region,last_heartbeat_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,$13,now())`,
      [id, DEMO_USER, v.name, v.status, v.kind, v.gpu === "—" ? "cpu_only" : `gpu_${v.gpu.toLowerCase()}`,
       v.gpu, v.gpu === "—" ? 0 : 16, 32, JSON.stringify({ cap }), 1, 90, v.region],
    )
    await pg.query(
      `INSERT INTO node_telemetry_current(node_id,cpu_pct,gpu_pct,ram_pct,throughput_mbps,epoch_earnings_myc,current_job,job_progress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, v.cpu, v.gpu_pct, v.ram, v.kind === "phone" ? 0 : 40 + rnd() * 800, v.earn, v.job, v.prog],
    )
  }

  // ---- simulated fleet (~44 nodes) ----
  const simIds: string[] = []
  for (let i = 0; i < 44; i++) {
    const id = uuid(100 + i)
    simIds.push(id)
    const kind = KINDS[Math.floor(rnd() * KINDS.length)]
    const gpu = kind === "phone" ? "—" : GPUS[Math.floor(rnd() * (GPUS.length - 1))]
    const region = REGIONS[Math.floor(rnd() * REGIONS.length)]
    const online = rnd() > 0.12
    const status = !online ? "offline" : rnd() > 0.35 ? "online" : "idle"
    const job = status === "online" ? SIM_JOBS[Math.floor(rnd() * SIM_JOBS.length)] : null
    const ownerId = uuid(900 + i)
    await pg.query(
      `INSERT INTO users(id,role,reputation,region) VALUES ($1,'provider',$2,$3) ON CONFLICT (id) DO NOTHING`,
      [ownerId, 50 + Math.floor(rnd() * 50), region],
    )
    await pg.query(
      `INSERT INTO nodes(id,user_id,display_name,status,kind,capability_class,gpu_model,gpu_vram_gb,ram_gb,
         capability,reliability_score,reputation,is_simulated,region,last_heartbeat_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,now())`,
      [id, ownerId, `node-${(i + 7).toString().padStart(3, "0")}`, status, kind,
       gpu === "—" ? "cpu_only" : `gpu_${gpu.toLowerCase()}`, gpu, gpu === "—" ? 0 : 8 + Math.floor(rnd() * 72),
       16 + Math.floor(rnd() * 48), JSON.stringify({}), 0.7 + rnd() * 0.3, 50 + Math.floor(rnd() * 50), region],
    )
    await pg.query(
      `INSERT INTO node_telemetry_current(node_id,cpu_pct,gpu_pct,ram_pct,throughput_mbps,epoch_earnings_myc,current_job,job_progress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, status === "offline" ? 0 : Math.floor(rnd() * 90), status === "online" ? 30 + Math.floor(rnd() * 70) : Math.floor(rnd() * 15),
       status === "offline" ? 0 : Math.floor(rnd() * 90), status === "offline" ? 0 : rnd() * 1200,
       Math.round(rnd() * 400 * 10) / 10, job, job ? Math.floor(rnd() * 100) : 0],
    )
  }

  // ---- seeded historical earnings for "you" (so the dashboard total is real) ----
  let key = 0
  const histTotal = 47000
  for (let i = 0; i < visibleIds.length; i++) {
    const amt = Math.round((histTotal / visibleIds.length) * (0.6 + rnd() * 0.8))
    await pg.query(
      `INSERT INTO ledger_entries(account_id,amount_myc,entry_type,idempotency_key,memo)
       VALUES ($1,$2,'provider_earn',$3,'historical earnings')`,
      [DEMO_USER, amt, `seed-hist-${key++}`],
    )
  }

  // ---- stake-at-risk per node (PLAN §8) ----
  await pg.query(`UPDATE nodes SET stake_myc = 120 + floor(random()*480) WHERE is_simulated=true`)
  await pg.query(`UPDATE nodes SET stake_myc = 300 WHERE is_simulated=false`)

  // ---- market snapshot ----
  await pg.query(
    `INSERT INTO market_snapshots(total_tflops,gpus_online,nodes_online,jobs_running,jobs_queued,jobs_per_sec,supply_units,demand_units,clearing_price_myc)
     VALUES (38420,942,1284,217,38,4.8,1284,1010,0.12)`,
  )

  // ---- seed net events ----
  const evs: [string, string, string][] = [
    ["round-aggregated", "scheduler", "llama-ft-7b · round 18"],
    ["tile-verified", "deepzoom-gpu", "tile 41 · fractal"],
    ["credited", "frankfurt-h100", "+18.2 MYC"],
    ["fanout", "scheduler", "sd-xl-inference → 12 nodes"],
    ["join", "tokyo-a100", "joined the mesh"],
  ]
  for (const [kind, node, detail] of evs) {
    await pg.query(`INSERT INTO net_events(kind,node_name,detail) VALUES ($1,$2,$3)`, [kind, node, detail])
  }

  // ---- initial in-progress fractal job: ~70% tiles pre-verified ----
  const p = DEFAULT_RENDER
  const total = tileCount(p)
  const perTile = 8
  const reward = total * perTile
  const allNodes = [...visibleIds, ...simIds]
  const jobId = uuid(5000)
  await pg.query(
    `INSERT INTO jobs(id,requester_id,name,type,params,total_tiles,completed_tiles,replication_factor,reward_bid_myc,status,requester_name,created_at)
     VALUES ($1,$2,$3,'render',$4,$5,0,4,$6,'running','fractal-studio',now())`,
    [jobId, DEMO_REQUESTER, "4K deep-zoom mandelbrot reel", JSON.stringify(p), total, reward],
  )
  // escrow hold
  await pg.query(
    `INSERT INTO ledger_entries(account_id,job_id,amount_myc,entry_type,idempotency_key,memo)
     VALUES ($1,$2,$3,'escrow_hold',$4,'initial job escrow')`,
    [DEMO_REQUESTER, jobId, -reward, `seed-escrow-${jobId}`],
  )
  await pg.query(
    `UPDATE account_balance SET available_myc = available_myc - $1, reserved_myc = reserved_myc + $1, updated_at=now() WHERE account_id=$2`,
    [reward, DEMO_REQUESTER],
  )

  let completed = 0
  for (let i = 0; i < total; i++) {
    const g = tileGeometry(p, i)
    const preseed = rnd() < 0.7
    const nodeId = allNodes[Math.floor(rnd() * allNodes.length)]
    const nodeRow = await pg.query<{ display_name: string; user_id: string }>(
      `SELECT display_name, user_id FROM nodes WHERE id=$1`, [nodeId])
    const nodeName = nodeRow.rows[0].display_name
    const ownerId = nodeRow.rows[0].user_id
    if (preseed) {
      const bytes = computeTile(p, i)
      const b64 = bytesToBase64(bytes)
      const hash = hashBytes(bytes)
      await pg.query(
        `INSERT INTO tiles(job_id,tile_index,px0,py0,px1,py1,cx0,cy0,cx1,cy1,params,status,assigned_node_id,assigned_node_name,
           result_uri,result_hash,result_bytes,gpu_ms,is_preseeded,completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'verified',$12,$13,$14,$15,$16,$17,true,now())`,
        [jobId, i, g.rect.px0, g.rect.py0, g.rect.px1, g.rect.py1, g.cx0, g.cy0, g.cx1, g.cy1,
         JSON.stringify(p), nodeId, nodeName, b64, hash, bytes.length, 80 + Math.floor(rnd() * 300)],
      )
      // pay out the pre-seeded tile
      const { provider, fee } = splitReward(perTile)
      await pg.query(
        `INSERT INTO ledger_entries(account_id,job_id,tile_id,amount_myc,entry_type,idempotency_key)
         VALUES ($1,$2,null,$3,'provider_earn',$4)`,
        [ownerId, jobId, provider, `seed-pay-${jobId}-${i}`],
      )
      await pg.query(
        `INSERT INTO ledger_entries(account_id,job_id,tile_id,amount_myc,entry_type,idempotency_key)
         VALUES ($1,$2,null,$3,'platform_fee',$4)`,
        [PLATFORM_ACCOUNT, jobId, fee, `seed-fee-${jobId}-${i}`],
      )
      await pg.query(
        `UPDATE account_balance SET reserved_myc = reserved_myc - $1, updated_at=now() WHERE account_id=$2`,
        [perTile, DEMO_REQUESTER],
      )
      completed++
    } else {
      await pg.query(
        `INSERT INTO tiles(job_id,tile_index,px0,py0,px1,py1,cx0,cy0,cx1,cy1,params,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')`,
        [jobId, i, g.rect.px0, g.rect.py0, g.rect.px1, g.rect.py1, g.cx0, g.cy0, g.cx1, g.cy1, JSON.stringify(p)],
      )
    }
  }
  await pg.query(`UPDATE jobs SET completed_tiles=$1 WHERE id=$2`, [completed, jobId])

  // ---- a few marketplace listings (other workload types) ----
  const listings: [string, string, string, number, number, number, number, number, string][] = [
    ["llama-3-8b LoRA · support-bot", "lora", "A100", 80, 128, 1840, 32, 12, "northwind.ai"],
    ["sd-xl batch · product shots", "inference", "A10G", 24, 48, 410, 500, 0, "loomwear"],
    ["n-body galaxy collision", "sim", "H100", 80, 192, 3120, 40, 3, "caltech-astro"],
    ["whisper-v3 transcription run", "inference", "T4", 16, 32, 168, 120, 0, "podscribe"],
    ["blender cycles · arch viz", "render", "4090", 24, 64, 640, 96, 0, "studio-mono"],
    ["cfd wing turbulence sweep", "sim", "A10G", 24, 48, 760, 24, 9, "aerolab"],
  ]
  for (let i = 0; i < listings.length; i++) {
    const [name, type, gpu, vram, ram, rwd, tilesT, tilesD, requester] = listings[i]
    const status = tilesD === 0 ? "queued" : tilesD >= tilesT ? "completed" : "running"
    await pg.query(
      `INSERT INTO jobs(requester_id,name,type,params,req_gpu_model,req_ram_gb,total_tiles,completed_tiles,replication_factor,reward_bid_myc,status,requester_name,deadline_at,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now() + ($13 || ' hours')::interval, now())`,
      [DEMO_REQUESTER, name, type, JSON.stringify({ gpuTier: gpu, vram, ram }), gpu, ram,
       tilesT as number, tilesD as number, 2 + (i % 4), rwd as number, status, requester, String(2 + i * 5)],
    )
  }
}
