// Deterministic deep-zoom fractal kernel (PLAN.md §9 "the hero job").
//
// Pure, dependency-free, and isomorphic: the SAME code runs server-side (the
// simulator + the verification self-check) and in the browser Web Worker, so a
// tile computed by a real browser node hashes identically to the server's
// reference recompute. Determinism is exactly the property the ledger +
// self-check depend on.

export interface JobRenderParams {
  width: number
  height: number
  tilePx: number
  /** complex-plane center */
  cx: number
  cy: number
  /** complex-plane width spanned by the image */
  scale: number
  maxIter: number
}

export interface TileRect {
  px0: number
  py0: number
  px1: number
  py1: number
}

export const DEFAULT_RENDER: JobRenderParams = {
  width: 512,
  height: 512,
  tilePx: 64, // 8x8 = 64 tiles, matches the telemetry grid
  cx: -0.743643887037151, // seahorse valley
  cy: 0.13182590420533,
  scale: 0.0008,
  maxIter: 360,
}

/** Number of tiles for a given render. */
export function tileCount(p: JobRenderParams): number {
  return (p.width / p.tilePx) * (p.height / p.tilePx)
}

/** Pixel + complex rect for a given tile index (row-major). */
export function tileGeometry(p: JobRenderParams, index: number) {
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
    rect: { px0, py0, px1, py1 } as TileRect,
    cx0: left + (px0 / p.width) * cScaleX,
    cy0: top + (py0 / p.height) * cScaleY,
    cx1: left + (px1 / p.width) * cScaleX,
    cy1: top + (py1 / p.height) * cScaleY,
  }
}

/** Mandelbrot escape iteration count for one point. */
function escape(cre: number, cim: number, maxIter: number): number {
  let zr = 0
  let zi = 0
  let i = 0
  while (i < maxIter) {
    const zr2 = zr * zr
    const zi2 = zi * zi
    if (zr2 + zi2 > 4) break
    zi = 2 * zr * zi + cim
    zr = zr2 - zi2 + cre
    i++
  }
  return i
}

/**
 * Compute a tile → one byte per pixel (iteration count mapped to 0..255).
 * Returns row-major pixels of size tilePx*tilePx.
 */
export function computeTile(p: JobRenderParams, index: number): Uint8Array {
  const g = tileGeometry(p, index)
  const w = p.tilePx
  const h = p.tilePx
  const out = new Uint8Array(w * h)
  const dx = (g.cx1 - g.cx0) / w
  const dy = (g.cy1 - g.cy0) / h
  for (let y = 0; y < h; y++) {
    const cim = g.cy0 + dy * y
    for (let x = 0; x < w; x++) {
      const cre = g.cx0 + dx * x
      const it = escape(cre, cim, p.maxIter)
      // map escape iterations → byte; interior (never escaped) = 0
      out[y * w + x] = it >= p.maxIter ? 0 : 1 + ((it * 254) / p.maxIter) | 0
    }
  }
  return out
}

/** Fast deterministic FNV-1a 32-bit hash over bytes → 8-char hex. */
export function hashBytes(bytes: Uint8Array): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

/**
 * Verify a submitted tile against a fresh reference recompute (PLAN.md §9
 * deterministic self-check). Exact hash match passes immediately; otherwise we
 * allow a small per-pixel tolerance so the WebGPU (f32) path passes against the
 * f64 reference, while random/garbage results still fail badly (cheap
 * cross-architecture-FP handling, PLAN.md §8).
 */
export function verifyTile(
  p: JobRenderParams,
  index: number,
  submitted: Uint8Array,
): { ok: boolean; diffPct: number; refHash: string } {
  const ref = computeTile(p, index)
  const refHash = hashBytes(ref)
  if (submitted.length !== ref.length) return { ok: false, diffPct: 1, refHash }
  if (hashBytes(submitted) === refHash) return { ok: true, diffPct: 0, refHash }
  let diff = 0
  for (let i = 0; i < ref.length; i++) {
    if (Math.abs(ref[i] - submitted[i]) > 6) diff++
  }
  const diffPct = diff / ref.length
  return { ok: diffPct <= 0.02, diffPct, refHash }
}

// ---- portable base64 <-> bytes (works in Node and the browser) ------------

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64")
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"))
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
