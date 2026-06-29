// Bandwidth estimator for adaptive activation compression (BWE lineage).
// Tracks send-side throughput and RTT to pick int8 vs fp16 on the wire.

export interface BweSample {
  ts: number
  bytesSent: number
  rttMs: number
  lossRate: number
}

export interface BweEstimate {
  throughputMbps: number
  rttMs: number
  recommendedDtype: "int8" | "fp16" | "fp32"
  compressionK: number
}

const WINDOW = 32
const samples: BweSample[] = []

export function resetBwe(): void {
  samples.length = 0
}

export function recordSample(s: BweSample): void {
  samples.push(s)
  if (samples.length > WINDOW) samples.shift()
}

export function estimate(): BweEstimate {
  if (samples.length === 0) {
    return { throughputMbps: 100, rttMs: 30, recommendedDtype: "fp16", compressionK: 0.02 }
  }
  const recent = samples.slice(-8)
  const dt = (recent[recent.length - 1].ts - recent[0].ts) / 1000 || 1
  const bytes = recent.reduce((s, x) => s + x.bytesSent, 0)
  const throughputMbps = (bytes * 8) / (dt * 1e6)
  const rttMs = recent.reduce((s, x) => s + x.rttMs, 0) / recent.length
  const loss = recent.reduce((s, x) => s + x.lossRate, 0) / recent.length

  let recommendedDtype: BweEstimate["recommendedDtype"] = "fp16"
  let compressionK = 0.02
  if (throughputMbps < 20 || loss > 0.05) {
    recommendedDtype = "int8"
    compressionK = 0.01
  } else if (throughputMbps > 200 && rttMs < 20) {
    recommendedDtype = "fp32"
    compressionK = 0.05
  }
  return { throughputMbps, rttMs, recommendedDtype, compressionK }
}
