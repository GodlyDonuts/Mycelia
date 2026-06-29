// Activation CPU-offload for VRAM-constrained nodes (ZeRO-Offload lineage).
// Keeps optimizer states on host RAM; ships only adapter deltas over WAN.

export interface OffloadPolicy {
  optimizerOnCpu: boolean
  activationCheckpointing: boolean
  swapThresholdGb: number
}

export const CONSUMER_GPU_POLICY: OffloadPolicy = {
  optimizerOnCpu: true,
  activationCheckpointing: true,
  swapThresholdGb: 10,
}

export function vramEstimate(paramsB: number, loraRank: number, batch: number, seqLen: number): number {
  const baseGb = paramsB * 0.5 // 4-bit quant rough
  const loraMb = (loraRank * 4096 * 2 * 4) / 1e6
  const actMb = (batch * seqLen * 4096 * 2) / 1e6
  return baseGb + loraMb / 1024 + actMb / 1024
}

export function shouldOffload(vramGb: number, estimateGb: number, policy: OffloadPolicy): boolean {
  return estimateGb > vramGb - policy.swapThresholdGb
}

export function checkpointInterval(layers: number, vramGb: number): number {
  return Math.max(1, Math.floor(layers / Math.max(vramGb / 4, 1)))
}
