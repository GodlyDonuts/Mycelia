import { describe, it, expect } from "vitest"
import { adjudicate, traceHashes } from "@/lib/referee"
import { DEFAULT_RENDER, computeTile } from "@/lib/fractal"

const P = DEFAULT_RENDER
const N = P.tilePx

function corruptRow(bytes: Uint8Array, row: number): Uint8Array {
  const b = bytes.slice()
  for (let x = 0; x < N; x++) b[row * N + x] = (b[row * N + x] + 77) & 255
  return b
}

describe("refereed-delegation recompute", () => {
  it("identical results agree, no recompute needed", () => {
    const a = computeTile(P, 9)
    const r = adjudicate(P, 9, a, a.slice())
    expect(r.agree).toBe(true)
    expect(r.rowsRecomputed).toBe(0)
  })

  it("finds the first divergent row and convicts the cheater (A honest)", () => {
    const honest = computeTile(P, 14)
    const cheat = corruptRow(honest, 40)
    const r = adjudicate(P, 14, honest, cheat)
    expect(r.agree).toBe(false)
    expect(r.divergentRow).toBe(40)
    expect(r.winner).toBe("A")
    expect(r.rowsRecomputed).toBe(1)
  })

  it("convicts the cheater regardless of argument order (B honest)", () => {
    const honest = computeTile(P, 14)
    const cheat = corruptRow(honest, 12)
    const r = adjudicate(P, 14, cheat, honest)
    expect(r.divergentRow).toBe(12)
    expect(r.winner).toBe("B")
  })

  it("uses ~log2(rows) comparisons, not O(rows)", () => {
    const honest = computeTile(P, 3)
    const cheat = corruptRow(honest, N - 1)
    const r = adjudicate(P, 3, honest, cheat)
    expect(r.comparisons).toBeLessThanOrEqual(Math.ceil(Math.log2(N)) + 1)
    expect(r.totalRows).toBe(N)
    expect(r.speedup).toBeGreaterThan(1)
  })

  it("cumulative trace divergence is monotonic (stays diverged once differing)", () => {
    const honest = computeTile(P, 5)
    const cheat = corruptRow(honest, 20)
    const A = traceHashes(honest, N)
    const B = traceHashes(cheat, N)
    let firstDiff = -1
    for (let i = 0; i < N; i++) if (A[i] !== B[i]) { firstDiff = i; break }
    expect(firstDiff).toBe(20)
    for (let i = firstDiff; i < N; i++) expect(A[i]).not.toBe(B[i]) // monotonic
  })
})
