// Ledger property/fuzz test (PLAN §6). Drives randomized interleavings of
// submit / honest-compute / cheat / redeem against the live system and asserts
// the ledger invariants hold THROUGHOUT: no account_balance goes negative, and
// per job, payouts + refunds never exceed escrow held (no money printed). Run
// with the dev server up:  node test/fuzz.mjs   [ITERS=60]
//
//   cd frontend && pnpm dev   # one terminal
//   node test/fuzz.mjs        # another

const BASE = process.env.BASE || "http://localhost:3000"
const ITERS = Number(process.env.ITERS || 60)
let checks = 0
let fails = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rnd = (n) => Math.floor(Math.random() * n)
async function j(url, opts) {
  const r = await fetch(BASE + url, opts)
  return { status: r.status, body: await r.json().catch(() => null) }
}
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
  return Buffer.from(out).toString("base64")
}

async function invariantsHold(where) {
  checks++
  const h = (await j("/api/health")).body
  const r = h?.reconciliation
  const ok = r && r.ok === true && r.negativeBalances === 0 && r.overspentJobs === 0
  if (!ok) { fails++; console.log(`  ✗ invariant broken after ${where}:`, JSON.stringify(r)) }
  return ok
}

async function main() {
  console.log(`Mycelia ledger fuzz → ${BASE} (${ITERS} iterations)`)
  await j("/api/network") // start the driver
  const nodes = []
  for (let i = 0; i < 3; i++) nodes.push((await post("/api/nodes/register", { name: `fuzz-${i}`, kind: "browser" })).body.id)

  for (let it = 0; it < ITERS; it++) {
    const op = rnd(4)
    try {
      if (op === 0) {
        // submit a random job (anonymous → demo requester)
        await post("/api/submit", { name: `fuzz-${it}`, type: "render", gpuTier: "4090", vram: 24, ram: 64, maxRuntimeMin: 30, replication: 1 + rnd(3), rewardBid: 50 + rnd(400) })
      } else if (op === 1 || op === 2) {
        // pull a tile and submit honest (op1) or cheat (op2)
        const nodeId = nodes[rnd(nodes.length)]
        const claim = (await post("/api/pull-work", { nodeId, nodeName: "fuzz" })).body.tile
        if (claim) {
          let b64 = tileBytes(claim.params, claim.tileIndex)
          if (op === 2) { const buf = Buffer.from(b64, "base64"); for (let x = 0; x < buf.length; x += 3) buf[x] = (buf[x] + 90) & 255; b64 = buf.toString("base64") }
          await post("/api/submit-result", { tileId: claim.tileId, nodeId, nodeName: "fuzz", resultB64: b64 })
        }
      } else {
        // redeem a small random amount
        await post("/api/wallet/redeem", { amount: 1 + rnd(50), method: ["bank", "giftcard", "crypto"][rnd(3)] })
      }
    } catch {
      /* transient — invariants still checked below */
    }
    if (it % 6 === 0) await invariantsHold(`op ${it}`)
    await sleep(40)
  }
  await sleep(500)
  await invariantsHold("final settle")

  console.log(`\n${checks - fails}/${checks} invariant checks held, ${fails} broken`)
  process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
