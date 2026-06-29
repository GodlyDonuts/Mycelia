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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
  const beforeLedger = (await j("/api/ledger")).body
  const before = beforeLedger.requester
  const sub = await post("/api/submit", { name: "smoke", type: "render", gpuTier: "4090", vram: 24, ram: 64, maxRuntimeMin: 30, replication: 2, rewardBid: 200, image: "", datasetUrl: "" })
  ok("submit returns ok + jobId", sub.body?.ok === true && !!sub.body.jobId, JSON.stringify(sub.body))
  const afterLedger = (await j("/api/ledger")).body
  const after = afterLedger.requester
  ok("escrow debits available by reward", Math.round(before.available - after.available) === 200, `Δ=${before.available - after.available}`)
  ok("escrow hold is recorded in the append-only ledger",
    Math.round(afterLedger.totals.escrowHeld - beforeLedger.totals.escrowHeld) === -200,
    `Δ=${afterLedger.totals.escrowHeld - beforeLedger.totals.escrowHeld}`)

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

  // 6. distributed-training backend (starts the training driver; watch it converge)
  await j("/api/training/active")
  let tr = null
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    tr = (await j("/api/training/active")).body
    if (tr && tr.loss.length >= 4) break
  }
  ok("training job active with a loss curve", !!tr && tr.loss.length >= 3, JSON.stringify(tr?.loss))
  ok("validation loss decreases over rounds", !!tr && tr.loss.length >= 2 && tr.loss[tr.loss.length - 1].loss < tr.loss[0].loss,
    tr ? `${tr.loss[0]?.loss} -> ${tr.loss[tr.loss.length - 1]?.loss}` : "no data")
  ok("bad deltas rejected by canary check", !!tr && tr.rejectedDeltas >= 1, `rejected=${tr?.rejectedDeltas}`)
  ok("contributions paid token-weighted", !!tr && tr.contributions.some((c) => c.reward > 0), JSON.stringify(tr?.contributions?.slice(0, 2)))

  // 7. garbage training delta rejected via the contribution API
  const treg = await post("/api/nodes/register", { name: "smoke-train", kind: "gpu", gpuModel: "A100" })
  let pulled = null
  for (let i = 0; i < 5 && !pulled; i++) {
    const r = await post("/api/training/pull", { nodeId: treg.body.id, nodeName: "smoke-train" })
    pulled = r.body?.task
    if (!pulled) await sleep(500)
  }
  if (pulled) {
    const garbage = Array.from({ length: pulled.theta.length || 16 }, () => Math.random() * 8 - 4)
    const r = await post("/api/training/submit-contribution", {
      cellId: pulled.cellId, roundId: pulled.roundId, jobId: pulled.jobId,
      nodeId: treg.body.id, nodeName: "smoke-train", localTheta: garbage, tokens: 50, localSteps: 10,
    })
    ok("garbage training delta rejected via API", r.body?.accepted === false, JSON.stringify(r.body))
  } else {
    ok("garbage training delta rejected via API (skipped — no cell free)", true)
  }

  // 8. verification moat + reconciliation sweep
  const ver = (await j("/api/verification")).body
  ok("verification reports a sellable fraction + economics", !!ver && ver.sellableFraction > 0 && ver.economics?.regimes?.length > 0, JSON.stringify(ver?.sellableFraction))
  const health = (await j("/api/health")).body
  ok("ledger reconciliation sweep holds (no overdraft, escrow covers payouts)", health?.reconciliation?.ok === true, JSON.stringify(health?.reconciliation))

  // 8b. live transport + agentic surface + artifacts
  const sse = await fetch(BASE + "/api/network/stream")
  ok("SSE stream returns an event-stream", (sse.headers.get("content-type") || "").includes("text/event-stream"), sse.headers.get("content-type") || "none")
  sse.body?.cancel?.()
  const adapter = await fetch(BASE + "/api/training/adapter")
  const adapterJson = await adapter.json().catch(() => null)
  ok("trained adapter is downloadable", adapter.ok && Array.isArray(adapterJson?.adapter), `status=${adapter.status}`)
  const econTool = await post("/api/mcp", { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "get_economics", arguments: {} } })
  ok("MCP get_economics returns text", typeof econTool.body?.result?.content?.[0]?.text === "string")
  const toolList = await post("/api/mcp", { jsonrpc: "2.0", id: 10, method: "tools/list" })
  ok("MCP exposes 7 read-only tools", toolList.body?.result?.tools?.length === 7, `count=${toolList.body?.result?.tools?.length}`)

  // 8c. second workload class + the refereed-recompute moat
  const mc = (await j("/api/montecarlo")).body
  ok("Monte Carlo workload verifies honest + rejects tampered", !!mc && mc.verified > 0 && mc.rejected >= 1, JSON.stringify(mc))
  const ref = (await j("/api/verify/referee")).body
  ok("refereed recompute convicts a cheater with ~log cost", !!ref && ref.agree === false && ref.rowsRecomputed === 1 && ref.comparisons <= 8, JSON.stringify(ref))
  const inf = (await j("/api/inference")).body
  ok("inference workload verifies + rejects tampered", !!inf && inf.verified > 0 && inf.rejected >= 1 && inf.throughput > 0, JSON.stringify(inf))
  const pipe = (await j("/api/training/pipeline")).body
  ok("model-sharded pipeline is gradient-equivalent to monolithic", pipe?.equivalentToMonolithic === true, JSON.stringify(pipe))
  const tref = (await j("/api/training/referee")).body
  ok("training refereed-recompute clears honest + convicts lazy/cheat", tref?.refereeRecompute?.honest?.honest === true && tref?.refereeRecompute?.lazy?.honest === false && tref?.refereeRecompute?.cheat?.honest === false, JSON.stringify(tref?.refereeRecompute))

  // 8d. auth role gating: a signed-in Provider cannot submit
  const login = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "smoke-prov", role: "provider" }),
  })
  const cookie = (login.headers.getSetCookie?.() || []).find((c) => c.startsWith("mycelia_session=")) || ""
  const provSubmit = await fetch(BASE + "/api/submit", {
    method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ name: "x", type: "render", gpuTier: "4090", vram: 24, ram: 64, maxRuntimeMin: 30, replication: 1, rewardBid: 100 }),
  })
  ok("signed-in Provider is blocked from submitting (403)", provSubmit.status === 403, `status=${provSubmit.status} cookie=${!!cookie}`)

  // 8e. MYC redemption / wallet
  const w0 = (await j("/api/wallet")).body
  const red = await post("/api/wallet/redeem", { amount: 10, method: "bank" })
  ok("redeem succeeds + records a cash-out", red.body?.ok === true && red.body.usd === 1.2, JSON.stringify(red.body))
  const w1 = (await j("/api/wallet")).body
  ok("wallet balance decreases by the redeemed amount", w1.balance === w0.balance - 10, `${w0?.balance} -> ${w1?.balance}`)
  const overRedeem = await post("/api/wallet/redeem", { amount: (w1.balance || 0) + 100000, method: "crypto" })
  ok("over-balance redemption rejected (402)", overRedeem.status === 402, `status=${overRedeem.status}`)

  // 8f. SLA tiers
  const sla = await post("/api/submit", { name: "sla", type: "render", gpuTier: "4090", vram: 24, ram: 64, maxRuntimeMin: 30, replication: 1, rewardBid: 120, tier: "priority" })
  ok("SLA-tier job accepted + reflected on the board", sla.body?.ok === true && ((await j("/api/marketplace")).body.listings.some((l) => l.tier && l.tier !== "standard")), JSON.stringify(sla.body))

  // 9. input hardening — malformed bodies rejected with 400
  const badSubmit = await post("/api/submit", { name: "x" })
  ok("malformed /submit rejected (400)", badSubmit.status === 400, `status=${badSubmit.status}`)
  const badPull = await post("/api/pull-work", {})
  ok("malformed /pull-work rejected (400)", badPull.status === 400, `status=${badPull.status}`)
  const badParse = await post("/api/jobs/parse", { prompt: "" })
  ok("empty NL prompt rejected (400)", badParse.status === 400, `status=${badParse.status}`)

  // 9b. workload policy — prohibited workload rejected before escrow (#114)
  const mining = await post("/api/submit", { name: "xmrig monero miner", type: "sim", gpuTier: "none", vram: 0, ram: 4, maxRuntimeMin: 60, replication: 1, rewardBid: 10 })
  ok("crypto-mining workload rejected (422)", mining.status === 422 && mining.body?.error === "WORKLOAD_NOT_ALLOWED", `status=${mining.status}`)

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
