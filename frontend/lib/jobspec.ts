// The job-submission contract. This is the single Zod schema that guards the
// ledger: the NL endpoint's model output is re-validated against it before it
// can reach /submit (PLAN.md §6 "re-validated against the same Zod schema").

import { z } from "zod"

export const JOB_TYPES = ["render", "inference", "sim", "lora"] as const
export const GPU_TIERS = ["none", "T4", "A10G", "4090", "A100", "H100"] as const
export const SLA_TIERS = ["standard", "priority", "realtime"] as const

/** SLA price multipliers (PLAN §5 SLA tiering): pay more for faster scheduling. */
export const SLA_MULTIPLIER: Record<(typeof SLA_TIERS)[number], number> = {
  standard: 1,
  priority: 1.6,
  realtime: 2.5,
}

export const JobSpecSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(JOB_TYPES),
  image: z.string().max(300).optional().default(""),
  datasetUrl: z.string().max(300).optional().default(""),
  gpuTier: z.enum(GPU_TIERS),
  vram: z.number().min(0).max(192),
  ram: z.number().min(0).max(512),
  maxRuntimeMin: z.number().min(1).max(2880),
  replication: z.number().int().min(1).max(8),
  rewardBid: z.number().min(1).max(1_000_000),
  tier: z.enum(SLA_TIERS).optional().default("standard"),
})

export type JobSpec = z.infer<typeof JobSpecSchema>

/** Map a GPU tier to the capability_class a tile claim filters on. */
export function tierToCapabilityClass(tier: (typeof GPU_TIERS)[number]): string {
  return tier === "none" ? "cpu_only" : `gpu_${tier.toLowerCase()}`
}
