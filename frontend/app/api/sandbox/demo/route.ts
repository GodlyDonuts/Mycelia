import { NextResponse } from "next/server"
import { runSandboxed } from "@/lib/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Live host-protection demo (PLAN §8): run three untrusted kernels in the
// capability-denied sandbox — a benign compute, an attempt to touch the host
// filesystem (denied), and a runaway loop (killed by the time cap).
export async function GET() {
  const benign = runSandboxed("let s = 0; for (let i = 0; i < input; i++) s += i; return s", 100000)
  const denied = runSandboxed("return require('fs').readFileSync('/etc/passwd', 'utf8')", null)
  const runaway = runSandboxed("while (true) {}", null, { timeoutMs: 120 })
  return NextResponse.json({
    benign: { ok: benign.ok, value: benign.value, ms: benign.ms },
    denied: { denied: !denied.ok, error: denied.error, ms: denied.ms },
    runaway: { killed: runaway.killed === true, ms: runaway.ms },
    note: "node:vm capability + resource demo; production isolation is Wasmtime/WASI (Firecracker/gVisor for native).",
  })
}
