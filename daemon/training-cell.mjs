#!/usr/bin/env node
/**
 * Training cell supervisor — manages local pipeline stages and reports to coordinator.
 * Spawns stage workers and monitors ICE session health.
 *
 *   node daemon/training-cell.mjs --cell cell-alpha --stages 2
 */

import { spawn } from "node:child_process"
import { request } from "node:https"
import { request as httpRequest } from "node:http"

const BASE = process.env.MYCELIA_COORDINATOR ?? "http://localhost:3000"
const args = process.argv.slice(2)
const cellId = args.includes("--cell") ? args[args.indexOf("--cell") + 1] : "cell-local"
const stages = args.includes("--stages") ? Number(args[args.indexOf("--stages") + 1]) : 1

async function fetchJson(path) {
  const url = new URL(path, BASE)
  const mod = url.protocol === "https:" ? request : httpRequest
  return new Promise((resolve, reject) => {
    mod(url, (res) => {
      let body = ""
      res.on("data", (c) => (body += c))
      res.on("end", () => resolve(JSON.parse(body)))
    }).on("error", reject)
  })
}

console.log(`[training-cell] cell=${cellId} stages=${stages} coordinator=${BASE}`)

const workers = []
for (let s = 0; s < stages; s++) {
  const child = spawn("node", ["examples/pipeline_stage_worker.py", "--stage", String(s + 1)], {
    stdio: "inherit",
    shell: true,
  })
  workers.push(child)
}

setInterval(async () => {
  try {
    const mesh = await fetchJson("/api/p2p/mesh")
    const membership = await fetchJson("/api/distributed/membership")
    console.log(
      `[training-cell] heartbeat links=${mesh.pipelineLinks} quorum=${membership.quorum?.hasQuorum}`,
    )
  } catch (e) {
    console.warn("[training-cell] coordinator unreachable:", e.message)
  }
}, 10000)

process.on("SIGINT", () => {
  workers.forEach((w) => w.kill())
  process.exit(0)
})
