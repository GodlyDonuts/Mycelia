#!/usr/bin/env node
// Mycelia native daemon — the real off-browser supply engine (PLAN §3).
//
// Unlike a browser tab (throttled the moment it's backgrounded), this is a
// long-lived OS process that harvests idle multicore CPU: it registers with the
// coordinator, pulls real fractal tiles, computes them across N worker threads,
// submits verified results, and heartbeats — with idle-only scheduling (yields
// when the machine is busy) and a power-cap duty cycle (the 80–90% trick).
//
//   node daemon/mycelia-daemon.mjs --cores 4 --power 0.85 --idle
//   MYCELIA_URL=http://localhost:3000 node daemon/mycelia-daemon.mjs
//
// Flags: --url <u> --name <n> --cores <N> --power <0..1> --idle --gpu

import os from "node:os"
import { Worker } from "node:worker_threads"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dir = dirname(fileURLToPath(import.meta.url))

function arg(flag, def) {
  const i = process.argv.indexOf(flag)
  if (i === -1) return def
  const v = process.argv[i + 1]
  return v && !v.startsWith("--") ? v : true
}

const URL_BASE = arg("--url", process.env.MYCELIA_URL || "http://localhost:3000")
const NAME = arg("--name", `${os.hostname().split(".")[0]}-daemon`)
const CORES = Math.max(1, Math.min(os.cpus().length, parseInt(arg("--cores", String(Math.max(1, os.cpus().length - 1))), 10)))
const POWER = Math.max(0.1, Math.min(1, parseFloat(arg("--power", "0.9"))))
const IDLE_ONLY = arg("--idle", false) === true
const IS_GPU = arg("--gpu", false) === true

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function post(path, body) {
  const res = await fetch(URL_BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  return res.json()
}

let running = true
const stats = { tiles: 0, earned: 0, rejected: 0, lastGpuMs: 0 }
let busyCores = 0

/** Real idle detection: 1-min load average per core. Yield to the user's work. */
function systemBusy() {
  return os.loadavg()[0] / os.cpus().length > 0.7
}

// ---- worker-thread pool ----------------------------------------------------
function makeWorker() {
  const w = new Worker(join(__dir, "worker.mjs"))
  const pending = new Map()
  let seq = 0
  w.on("message", (m) => {
    const r = pending.get(m.id)
    if (r) { pending.delete(m.id); r(m) }
  })
  w.compute = (params, index) =>
    new Promise((resolve) => {
      const id = ++seq
      pending.set(id, resolve)
      w.postMessage({ id, params, index })
    })
  return w
}

async function workerLoop(w, node) {
  while (running) {
    if (IDLE_ONLY && systemBusy()) {
      await sleep(1500)
      continue
    }
    let tile
    try {
      const r = await post("/api/pull-work", { nodeId: node.id, nodeName: NAME })
      tile = r.tile
    } catch {
      await sleep(2000)
      continue
    }
    if (!tile) {
      await sleep(1200 + Math.random() * 800)
      continue
    }
    busyCores++
    const t0 = performance.now()
    try {
      const { b64, gpuMs } = await w.compute(tile.params, tile.tileIndex)
      stats.lastGpuMs = gpuMs
      const out = await post("/api/submit-result", { tileId: tile.tileId, nodeId: node.id, nodeName: NAME, resultB64: b64, gpuMs })
      if (out.verified) {
        stats.tiles++
        stats.earned = Math.round((stats.earned + (out.reward || 0)) * 100) / 100
      } else {
        stats.rejected++
      }
      // power-cap duty cycle: cooldown so CPU duty ≈ POWER
      const elapsed = performance.now() - t0
      const cooldown = elapsed * ((1 - POWER) / POWER)
      if (cooldown > 1) await sleep(cooldown)
    } catch {
      await sleep(1500)
    } finally {
      busyCores--
    }
  }
}

async function heartbeatLoop(node) {
  while (running) {
    const util = Math.round((busyCores / CORES) * 100)
    try {
      await post("/api/heartbeat", { nodeId: node.id, cpu: util, gpu: IS_GPU ? util : 0, ram: 30 + Math.round(util / 3), job: "fractal-deepzoom" })
    } catch {
      /* keep going */
    }
    await sleep(4000)
  }
}

function printStats() {
  const mode = `${CORES} cores · power ${Math.round(POWER * 100)}%${IDLE_ONLY ? " · idle-only" : ""}`
  process.stdout.write(
    `\r[mycelia] ${mode} | tiles ${stats.tiles} | earned ${stats.earned} MYC | last ${stats.lastGpuMs}ms | rejected ${stats.rejected}   `,
  )
}

async function main() {
  console.log(`Mycelia daemon → ${URL_BASE}`)
  const reg = await post("/api/nodes/register", { name: NAME, kind: IS_GPU ? "gpu" : "desktop", gpuModel: IS_GPU ? "native-gpu" : "—" })
  if (!reg.id) {
    console.error("registration failed:", reg)
    process.exit(1)
  }
  const node = { id: reg.id }
  console.log(`joined the mesh as ${NAME} (${node.id.slice(0, 8)}) · ${CORES} cores · power ${Math.round(POWER * 100)}%${IDLE_ONLY ? " · idle-only" : ""}`)

  const workers = Array.from({ length: CORES }, () => makeWorker())
  const loops = workers.map((w) => workerLoop(w, node))
  heartbeatLoop(node)
  const ticker = setInterval(printStats, 1000)

  const shutdown = async () => {
    running = false
    clearInterval(ticker)
    console.log(`\nleaving the mesh — contributed ${stats.tiles} tiles, earned ${stats.earned} MYC`)
    for (const w of workers) await w.terminate()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
  await Promise.all(loops)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
