// CPU fractal compute worker — the "Join the mesh" fallback path (PLAN.md §9:
// "feature-detect → TS-on-CPU Web Worker fallback"). The algorithm is a byte-
// exact replica of lib/fractal.ts::computeTile so a tile computed here passes
// the server's deterministic self-check (identical IEEE-754 f64 math).

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
  let bin = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

self.onmessage = (e) => {
  const { requestId, params, index } = e.data
  const t0 = performance.now()
  const bytes = computeTile(params, index)
  const b64 = bytesToBase64(bytes)
  const gpuMs = Math.round((performance.now() - t0) * 10) / 10
  self.postMessage({ requestId, b64, gpuMs })
}
