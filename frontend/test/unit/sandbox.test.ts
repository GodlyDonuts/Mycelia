import { describe, it, expect } from "vitest"
import { runSandboxed } from "@/lib/sandbox"

describe("capability sandbox", () => {
  it("runs a benign kernel and returns its result", () => {
    const r = runSandboxed("return input.a + input.b", { a: 2, b: 40 })
    expect(r.ok).toBe(true)
    expect(r.value).toBe(42)
  })

  it("allows the safe math primitives", () => {
    const r = runSandboxed("return Math.round(Math.sqrt(input))", 99)
    expect(r.value).toBe(10)
  })

  it("denies process / require / fetch (no ambient authority)", () => {
    // accessing missing capabilities throws (ReferenceError)
    expect(runSandboxed("return require('fs')", null).ok).toBe(false)
    expect(runSandboxed("return fetch('http://x')", null).ok).toBe(false)
    // and they're genuinely absent (not just throwing) — even via globalThis
    expect(runSandboxed("return typeof process", null).value).toBe("undefined")
    expect(runSandboxed("return typeof globalThis.process", null).value).toBe("undefined")
    expect(runSandboxed("return typeof globalThis.require", null).value).toBe("undefined")
  })

  it("kills runaway code with the time cap", () => {
    const r = runSandboxed("while(true){}", null, { timeoutMs: 80 })
    expect(r.ok).toBe(false)
    expect(r.killed).toBe(true)
  })
})
