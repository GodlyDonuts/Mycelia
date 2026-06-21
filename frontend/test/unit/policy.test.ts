import { describe, it, expect } from "vitest"
import { checkWorkloadPolicy, ALLOWED_WORKLOADS, MAX_RESULT_BYTES, MAX_RESULT_B64 } from "@/lib/policy"

describe("workload policy", () => {
  it("accepts vetted workload types", () => {
    for (const t of ALLOWED_WORKLOADS) {
      expect(checkWorkloadPolicy({ type: t, name: "nightly render" }).ok).toBe(true)
    }
  })

  it("rejects a workload type off the allowlist", () => {
    const v = checkWorkloadPolicy({ type: "webscrape" })
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/allowlist/)
  })

  it("rejects crypto-mining by name/image", () => {
    expect(checkWorkloadPolicy({ type: "sim", name: "xmrig monero miner" }).ok).toBe(false)
    expect(checkWorkloadPolicy({ type: "render", image: "docker.io/ethminer:latest" }).ok).toBe(false)
  })

  it("rejects credential cracking and network-attack tooling", () => {
    expect(checkWorkloadPolicy({ type: "sim", name: "hashcat wpa crack" }).ok).toBe(false)
    expect(checkWorkloadPolicy({ type: "inference", image: "nmap-portscan" }).ok).toBe(false)
  })

  it("rejects illegal-content generation", () => {
    expect(checkWorkloadPolicy({ type: "inference", name: "deepfake nude generator" }).ok).toBe(false)
  })

  it("does not flag a benign job that merely mentions a substring safely", () => {
    expect(checkWorkloadPolicy({ type: "render", name: "Mandelbrot explorer scene 12" }).ok).toBe(true)
  })

  it("result-size ceiling is sane (b64 derived from byte cap)", () => {
    expect(MAX_RESULT_BYTES).toBeGreaterThan(16 * 1024)
    expect(MAX_RESULT_B64).toBeGreaterThan(MAX_RESULT_BYTES)
  })
})
