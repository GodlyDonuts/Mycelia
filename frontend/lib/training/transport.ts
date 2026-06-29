// P2P activation transport layer (docs/ML_LAYER.md §3 Regime 2 — activations cross
// the wire between pipeline stages). Production uses WebRTC DataChannels with a
// relay fallback; here we model latency/bandwidth envelopes and verify ordering.

export type TransportMode = "webrtc-dc" | "relay" | "in-process"

export interface TransportEnvelope {
  stageFrom: number
  stageTo: number
  seq: number
  payloadBytes: number
  mode: TransportMode
  rttMs: number
  bandwidthMbps: number
}

export interface MeshPeer {
  nodeId: string
  region: string
  iceState: "new" | "checking" | "connected" | "failed"
  dcOpen: boolean
}

const REGION_RTT: Record<string, number> = {
  "us-east-1": 12,
  "us-west-2": 28,
  "eu-west-1": 95,
  "ap-southeast-1": 180,
}

export function estimateRtt(a: string, b: string): number {
  const base = (REGION_RTT[a] ?? 50) + (REGION_RTT[b] ?? 50)
  return Math.round(base * 0.55 + Math.random() * 8)
}

/** Serialize activation tensor metadata for wire budget accounting. */
export function activationWireBudget(hiddenDim: number, batch: number, dtype: "f16" | "f32" = "f16"): number {
  const bytesPerElem = dtype === "f16" ? 2 : 4
  return hiddenDim * batch * bytesPerElem
}

/** Ordered delivery check for pipeline micro-batches (seq must be monotonic per link). */
export function verifySeqOrder(prev: number, next: number): boolean {
  return next === prev + 1
}

/** Model a relay hop when direct WebRTC fails NAT traversal. */
export function relayOverhead(directRttMs: number): { rttMs: number; mode: TransportMode } {
  return { rttMs: Math.round(directRttMs * 1.35 + 15), mode: "relay" }
}

export function buildEnvelope(
  from: number,
  to: number,
  seq: number,
  hiddenDim: number,
  batch: number,
  peerA: string,
  peerB: string,
  mode: TransportMode = "webrtc-dc",
): TransportEnvelope {
  const payloadBytes = activationWireBudget(hiddenDim, batch)
  const rttMs = mode === "in-process" ? 0 : estimateRtt(peerA, peerB)
  const bandwidthMbps = mode === "relay" ? 45 : 120
  return { stageFrom: from, stageTo: to, seq, payloadBytes, mode, rttMs, bandwidthMbps }
}
