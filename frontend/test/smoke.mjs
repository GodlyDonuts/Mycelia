// Integration smoke test against the running dev server (no build/TS needed).
// Exercises the correctness-critical paths from PLAN.md §4/§6:
// escrow debit, overdraft rejection, cheat rejection, honest verify+pay,
// idempotent re-submit, and the read-only MCP tool surface.
//
//   pnpm dev   # in one terminal
//   node test/smoke.mjs

const BASE = process.env.BASE || "http://localhost:3000"
let pass = 0
let fail = 0
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log("  ✓", name) }
  else { fail++; console.log("  ✗", name, extra) }
}
async function j(url, opts) {
  const r = await fetch(BASE + url, opts)
  return { status: r.status, body: await r.json().catch(() => null) }
}
const post = (url, b) => j(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })

// --- byte-exact copy of the fractal kernel (lib/fractal.ts) ---
function tileGeometry(p, index) {
  const cols = p.width / p.tilePx
  const col = index % cols, row = Math.floor(index / cols)
  const px0 = col * p.tilePx, py0 = row * p.tilePx, px1 = px0 + p.tilePx, py1 = py0 + p.tilePx
  const aspect = p.height / p.width, sx = p.scale, sy = p.scale * aspect
  const left = p.cx - sx / 2, top = p.cy - sy / 2
  return { cx0: left + (px0 / p.width) * sx, cy0: top + (py0 / p.height) * sy, cx1: left + (px1 / p.width) * sx, cy1: top + (py1 / p.height) * sy }
}
function computeTile(p, index) {
  const g = tileGeometry(p, index), w = p.tilePx, h = p.tilePx, out = new Uint8Array(w * h)
  const dx = (g.cx1 - g.cx0) / w, dy = (g.cy1 - g.cy0) / h
  for (let y = 0; y < h; y++) { const cim = g.cy0 + dy * y
    for (let x = 0; x < w; x++) { const cre = g.cx0 + dx * x
      let zr = 0, zi = 0, i = 0
      while (i < p.maxIter) { const zr2 = zr * zr, zi2 = zi * zi; if (zr2 + zi2 > 4) break; zi = 2 * zr * zi + cim; zr = zr2 - zi2 + cre; i++ }
      out[y * w + x] = i >= p.maxIter ? 0 : (1 + ((i * 254) / p.maxIter) | 0)
    } }
  return out
}
const b64 = (bytes) => Buffer.from(bytes).toString("base64")

async function main() {
  console.log("Mycelia smoke test →", BASE)

  // 1. escrow debit through the serialization row
  const before = (await j("/api/ledger")).body.requester
  const sub = await post("/api/submit", { name: "smoke", type: "render", gpuTier: "4090", vram: 24, ram: 64, maxRuntimeMin: 30, replication: 2, rewardBid: 200, image: "", datasetUrl: "" })
  ok("submit returns ok + jobId", sub.body?.ok === true && !!sub.body.jobId, JSON.stringify(sub.body))
  const after = (await j("/api/ledger")).body.requester
  ok("escrow debits available by reward", Math.round(before.available - after.available) === 200, `Δ=${before.available - after.available}`)
  ok("escrow raises reserved by reward", Math.round(after.reserved - before.reserved) === 200, `Δ=${after.reserved - before.reserved}`)

  // 2. overdraft rejection (serialization-row guard)
  const over = await post("/api/submit", { name: "over", type: "render", gpuTier: "4090", vram: 24, ram: 64, maxRuntimeMin: 30, replication: 1, rewardBid: 1000000, image: "", datasetUrl: "" })
  ok("overdraft rejected with 402", over.status === 402, "status=" + over.status)

  // 3. claim → cheat (rejected) → honest (verified + paid)
  const reg = await post("/api/nodes/register", { name: "smoke-node", kind: "browser" })
  const nodeId = reg.body.id
  const claim = await post("/api/pull-work", { nodeId, nodeName: "smoke-node", jobId: sub.body.jobId })
  ok("claimed a pending tile", !!claim.body?.tile, JSON.stringify(claim.body))
  const t = claim.body.tile
  const cheat = await post("/api/submit-result", { tileId: t.tileId, nodeId, nodeName: "smoke-node", resultB64: b64(new Uint8Array(t.params.tilePx * t.params.tilePx)) })
  ok("cheat result fails self-check (not verified)", cheat.body?.verified === false, JSON.stringify(cheat.body))

  const claim2 = await post("/api/pull-work", { nodeId, nodeName: "smoke-node", jobId: sub.body.jobId })
  const t2 = claim2.body.tile
  const honest = await post("/api/submit-result", { tileId: t2.tileId, nodeId, nodeName: "smoke-node", resultB64: b64(computeTile(t2.params, t2.tileIndex)) })
  ok("honest result verified + paid", honest.body?.verified === true && honest.body?.reward > 0, JSON.stringify(honest.body))

  // 4. idempotent re-submit must not double-pay
  const youBefore = (await j("/api/ledger")).body.you.ledgerSum
  await post("/api/submit-result", { tileId: t2.tileId, nodeId, nodeName: "smoke-node", resultB64: b64(computeTile(t2.params, t2.tileIndex)) })
  const youAfter = (await j("/api/ledger")).body.you.ledgerSum
  ok("idempotent re-submit does not double-pay", youAfter === youBefore, `before=${youBefore} after=${youAfter}`)

  // 5. read-only MCP tool surface
  const mcp = await post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_mesh_status", arguments: {} } })
  ok("MCP get_mesh_status returns text content", typeof mcp.body?.result?.content?.[0]?.text === "string")

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
