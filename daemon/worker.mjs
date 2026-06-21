// Daemon compute thread. Runs the deep-zoom fractal kernel on one CPU core.
// Byte-exact with lib/fractal.ts so results pass the coordinator's self-check.
import { parentPort } from "node:worker_threads"

function tileGeometry(p, index) {
  const cols = p.width / p.tilePx
  const col = index % cols
  const row = Math.floor(index / cols)
  const px0 = col * p.tilePx
  const py0 = row * p.tilePx
  const px1 = px0 + p.tilePx
  const py1 = py0 + p.tilePx
  const aspect = p.height / p.width
  const cScaleX = p.scale
  const cScaleY = p.scale * aspect
  const left = p.cx - cScaleX / 2
  const top = p.cy - cScaleY / 2
  return {
    cx0: left + (px0 / p.width) * cScaleX,
    cy0: top + (py0 / p.height) * cScaleY,
    cx1: left + (px1 / p.width) * cScaleX,
    cy1: top + (py1 / p.height) * cScaleY,
  }
}
function escape(cre, cim, maxIter) {
  let zr = 0, zi = 0, i = 0
  while (i < maxIter) {
    const zr2 = zr * zr, zi2 = zi * zi
    if (zr2 + zi2 > 4) break
    zi = 2 * zr * zi + cim
    zr = zr2 - zi2 + cre
    i++
  }
  return i
}
function computeTile(p, index) {
  const g = tileGeometry(p, index)
  const w = p.tilePx, h = p.tilePx
  const out = new Uint8Array(w * h)
  const dx = (g.cx1 - g.cx0) / w
  const dy = (g.cy1 - g.cy0) / h
  for (let y = 0; y < h; y++) {
    const cim = g.cy0 + dy * y
    for (let x = 0; x < w; x++) {
      const cre = g.cx0 + dx * x
      const it = escape(cre, cim, p.maxIter)
      out[y * w + x] = it >= p.maxIter ? 0 : (1 + ((it * 254) / p.maxIter) | 0)
    }
  }
  return out
}
function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64")
}

parentPort.on("message", (msg) => {
  const t0 = performance.now()
  const bytes = computeTile(msg.params, msg.index)
  const b64 = bytesToBase64(bytes)
  parentPort.postMessage({ id: msg.id, b64, gpuMs: Math.round((performance.now() - t0) * 10) / 10 })
})
