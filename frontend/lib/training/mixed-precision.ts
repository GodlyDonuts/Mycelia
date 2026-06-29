// Mixed-precision training policy (bf16/fp16 compute, fp32 master weights).
// QLoRA path: 4-bit base frozen, adapter in fp16/bf16.

export type ComputeDtype = "bf16" | "fp16" | "fp32" | "int4"

export interface PrecisionPolicy {
  baseWeight: ComputeDtype
  adapterWeight: ComputeDtype
  activation: ComputeDtype
  gradientAccum: ComputeDtype
  lossScale?: number
}

export const QLORA_POLICY: PrecisionPolicy = {
  baseWeight: "int4",
  adapterWeight: "bf16",
  activation: "bf16",
  gradientAccum: "fp32",
}

export const FULL_FP16_POLICY: PrecisionPolicy = {
  baseWeight: "fp16",
  adapterWeight: "fp16",
  activation: "fp16",
  gradientAccum: "fp32",
  lossScale: 65536,
}

export function bytesPerParam(dtype: ComputeDtype): number {
  switch (dtype) {
    case "int4":
      return 0.5
    case "bf16":
    case "fp16":
      return 2
    case "fp32":
      return 4
  }
}

export function adapterMemoryBytes(dim: number, policy: PrecisionPolicy = QLORA_POLICY): number {
  return dim * bytesPerParam(policy.adapterWeight)
}

export function dynamicLossScale(current: number, overflow: boolean): number {
  if (overflow) return Math.max(current / 2, 1)
  return Math.min(current * 2, 65536)
}
