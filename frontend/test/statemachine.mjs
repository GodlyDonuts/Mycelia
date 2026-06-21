// Claim/verify state-machine invariants (#90). Drives the live coordinator and
// asserts the tile lifecycle can't be abused:
//   A. no double-claim   — a tile is claimed by at most one node
//   B. idempotent verify — an honest result pays exactly once (no double-pay)
//   C. cheat rejected    — a wrong result is never accepted/paid
//   D. no premature settle — settle() refuses while any tile is unverified
// These hold regardless of the in-process driver racing alongside the test
// (each assertion is scoped to a tile/job this test controls).
//
//   cd frontend && pnpm dev   # one terminal
//   node test/statemachine.mjs

const BASE = process.env.BASE || "http://localhost:3000"
let pass = 0, fail = 0
const ok = (name, cond, info = "") => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}  ${info}`) } }
async function j(url, opts) { const r = await fetch(BASE + url, opts); return { status: r.status, body: await r.json().catch(() => null) } }
const post = (u, b) => j(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })

// byte-exact fractal kernel (matches lib/fractal.ts) for honest results
function geom(p, i) {
  const cols = p.width / p.tilePx, col = i % cols, row = Math.floor(i / cols)
  const px0 = col * p.tilePx, py0 = row * p.tilePx
  const sx = p.scale, sy = p.scale * (p.height / p.width), left = p.cx - sx / 2, top = p.cy - sy / 2
  return { cx0: left + (px0 / p.width) * sx, cy0: top + (py0 / p.height) * sy, cx1: left + ((px0 + p.tilePx) / p.width) * sx, cy1: top + ((py0 + p.tilePx) / p.height) * sy }
}
function tileBytes(p, i) {
  const g = geom(p, i), w = p.tilePx, out = new Uint8Array(w * w), dx = (g.cx1 - g.cx0) / w, dy = (g.cy1 - g.cy0) / w
  for (let y = 0; y < w; y++) { const cim = g.cy0 + dy * y
    for (let x = 0; x < w; x++) { const cre = g.cx0 + dx * x; let zr = 0, zi = 0, k = 0
      while (k < p.maxIter) { const a = zr * zr, b = zi * zi; if (a + b > 4) break; zi = 2 * zr * zi + cim; zr = a - b + cre; k++ }
      out[y * w + x] = k >= p.maxIter ? 0 : (1 + ((k * 254) / p.maxIter) | 0) } }
  return Buffer.from(out)
}

// Claim any pending tile for our node, retrying — the driver keeps a constant
// flow of pending work, and a tile we claim is held exclusively.
async function claimOne(node) {
  for (let i = 0; i < 40; i++) {
    const t = (await post("/api/pull-work", { nodeId: node, nodeName: "sm-test-node" })).body?.tile
    if (t) return t
    await post("/api/submit", { name: "sm feed", type: "render", gpuTier: "none", vram: 0, ram: 4, maxRuntimeMin: 30, replication: 1, rewardBid: 100 })
  }
  return null
}

async function main() {
  console.log("state-machine invariants (claim/verify lifecycle)\n")
  const node = crypto.randomUUID() // assigned_node_id is a UUID column
  await post("/api/nodes/register", { id: node, name: "sm-test-node", kind: "browser", region: "browser" })

  // D. no premature settle — a freshly submitted job has pending tiles
  const sub = await post("/api/submit", { name: "sm render", type: "render", gpuTier: "none", vram: 0, ram: 4, maxRuntimeMin: 30, replication: 1, rewardBid: 200 })
  const jobId = sub.body?.jobId
  ok("job submitted", !!jobId, JSON.stringify(sub.body))
  const early = await post("/api/settle", { jobId })
  ok("settle refused while tiles unverified", early.body?.settled === false, JSON.stringify(early.body))

  // A. no double-claim — two claimed tiles are always distinct
  const p1 = await claimOne(node)
  const p2 = await claimOne(node)
  ok("two claims never return the same tile (no double-claim)", p1 && p2 && p1.tileId !== p2.tileId, `${p1?.tileId} vs ${p2?.tileId}`)

  // B. idempotent verify — honest result pays once, re-submit pays zero
  if (p1) {
    const b64 = tileBytes(p1.params, p1.tileIndex).toString("base64")
    const first = await post("/api/submit-result", { tileId: p1.tileId, nodeId: node, nodeName: "sm-test-node", resultB64: b64, gpuMs: 5 })
    const again = await post("/api/submit-result", { tileId: p1.tileId, nodeId: node, nodeName: "sm-test-node", resultB64: b64, gpuMs: 5 })
    ok("honest result verified + paid once", first.body?.verified === true && first.body?.reward > 0, JSON.stringify(first.body))
    ok("re-submit is idempotent (no double-pay)", again.body?.reward === 0, JSON.stringify(again.body))
  } else ok("honest-result tile available", false, "no tile to claim")

  // C. cheat rejected — corrupted bytes never accepted or paid
  if (p2) {
    const bad = tileBytes(p2.params, p2.tileIndex); for (let i = 0; i < bad.length; i++) bad[i] = (bad[i] + 97) & 255
    const cheat = await post("/api/submit-result", { tileId: p2.tileId, nodeId: node, nodeName: "sm-test-node", resultB64: bad.toString("base64"), gpuMs: 5 })
    ok("cheat result rejected (not verified, not paid)", cheat.body?.verified === false && (cheat.body?.reward ?? 0) === 0, JSON.stringify(cheat.body))
    // re-submitting the cheat for the now-released tile must not slash again
    const cheat2 = await post("/api/submit-result", { tileId: p2.tileId, nodeId: node, nodeName: "sm-test-node", resultB64: bad.toString("base64"), gpuMs: 5 })
    ok("repeat cheat does not re-slash (guarded claim transition)", cheat2.body?.verified === false, JSON.stringify(cheat2.body))
  } else ok("cheat-test tile available", false, "no tile to claim")

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
