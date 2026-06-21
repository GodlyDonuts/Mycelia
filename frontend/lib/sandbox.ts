// Host protection (PLAN §8): untrusted job code must run capability-denied-by-
// default with hard resource caps. The production design runs every job in a
// WASM/WASI sandbox via Wasmtime (or Firecracker/gVisor for native/GPU jobs).
//
// This is the buildable slice of that model without the Wasmtime runtime: run
// the kernel in a node:vm context that exposes ONLY explicit inputs + safe
// primitives — no process, require, fetch, fs, or globalThis — with a wall-clock
// timeout that kills runaway code. (node:vm is a capability/resource demo, not a
// hardened isolation boundary; true isolation is Wasmtime/Firecracker, roadmap.)

import vm from "node:vm"

export interface SandboxOutcome {
  ok: boolean
  value?: unknown
  error?: string
  killed?: boolean // exceeded the time cap
  ms: number
}

const SAFE_GLOBALS = ["Math", "JSON", "Array", "Object", "Number", "String", "Boolean", "isNaN", "isFinite", "parseInt", "parseFloat"]

/**
 * Run an untrusted kernel body `(input) => result` in a capability-denied
 * context with a time cap. The kernel sees `input` and the safe globals only.
 */
export function runSandboxed(source: string, input: unknown, opts: { timeoutMs?: number } = {}): SandboxOutcome {
  const timeoutMs = opts.timeoutMs ?? 250
  const sandbox: Record<string, unknown> = Object.create(null)
  for (const g of SAFE_GLOBALS) sandbox[g] = (globalThis as Record<string, unknown>)[g]
  sandbox.input = input
  sandbox.__result = undefined
  const ctx = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } })
  const t0 = performance.now()
  try {
    const script = new vm.Script(`"use strict"; __result = (function(input){ ${source}\n })(input)`)
    script.runInContext(ctx, { timeout: timeoutMs })
    return { ok: true, value: sandbox.__result, ms: Math.round((performance.now() - t0) * 100) / 100 }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg, killed: /timed out|timeout/i.test(msg), ms: Math.round((performance.now() - t0) * 100) / 100 }
  }
}
