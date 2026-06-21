import { describe, it, expect } from "vitest"
import {
  DEFAULT_RENDER,
  tileCount,
  tileGeometry,
  computeTile,
  hashBytes,
  verifyTile,
  bytesToBase64,
  base64ToBytes,
} from "@/lib/fractal"

describe("fractal kernel", () => {
  it("computes the expected tile count for the default render", () => {
    expect(tileCount(DEFAULT_RENDER)).toBe((DEFAULT_RENDER.width / DEFAULT_RENDER.tilePx) ** 2)
  })

  it("is deterministic — same tile hashes identically across runs", () => {
    const a = computeTile(DEFAULT_RENDER, 7)
    const b = computeTile(DEFAULT_RENDER, 7)
    expect(hashBytes(a)).toBe(hashBytes(b))
    expect(a.length).toBe(DEFAULT_RENDER.tilePx * DEFAULT_RENDER.tilePx)
  })

  it("produces different output for different tiles", () => {
    expect(hashBytes(computeTile(DEFAULT_RENDER, 0))).not.toBe(hashBytes(computeTile(DEFAULT_RENDER, 20)))
  })

  it("tileGeometry covers the image without gaps", () => {
    const g0 = tileGeometry(DEFAULT_RENDER, 0)
    expect(g0.rect.px0).toBe(0)
    expect(g0.rect.py0).toBe(0)
    const last = tileGeometry(DEFAULT_RENDER, tileCount(DEFAULT_RENDER) - 1)
    expect(last.rect.px1).toBe(DEFAULT_RENDER.width)
    expect(last.rect.py1).toBe(DEFAULT_RENDER.height)
  })

  it("verifyTile accepts an honest recompute", () => {
    const bytes = computeTile(DEFAULT_RENDER, 12)
    const v = verifyTile(DEFAULT_RENDER, 12, bytes)
    expect(v.ok).toBe(true)
    expect(v.diffPct).toBe(0)
  })

  it("verifyTile rejects garbage and wrong-length results", () => {
    const garbage = new Uint8Array(DEFAULT_RENDER.tilePx * DEFAULT_RENDER.tilePx).fill(123)
    expect(verifyTile(DEFAULT_RENDER, 12, garbage).ok).toBe(false)
    expect(verifyTile(DEFAULT_RENDER, 12, new Uint8Array(3)).ok).toBe(false)
  })

  it("verifyTile tolerates a few off pixels (WebGPU f32 path)", () => {
    const bytes = computeTile(DEFAULT_RENDER, 5)
    // perturb ~1% of pixels by a small amount
    const perturbed = bytes.slice()
    for (let i = 0; i < perturbed.length; i += 130) perturbed[i] = Math.min(255, perturbed[i] + 3)
    expect(verifyTile(DEFAULT_RENDER, 5, perturbed).ok).toBe(true)
  })

  it("base64 round-trips bytes losslessly", () => {
    const bytes = computeTile(DEFAULT_RENDER, 3)
    const round = base64ToBytes(bytesToBase64(bytes))
    expect(hashBytes(round)).toBe(hashBytes(bytes))
  })
})
