// Zod request schemas for every write endpoint, so a malformed or hostile body
// is rejected with a clear 400 before it can touch the coordinator or ledger
// (PLAN §6 "Zod on every Server Action/Route Handler").

import { z } from "zod"

export const PullWorkBody = z.object({
  nodeId: z.string().min(1).max(64),
  nodeName: z.string().min(1).max(120),
  jobId: z.string().max(64).optional(),
})

export const SubmitResultBody = z.object({
  tileId: z.string().min(1).max(64),
  nodeId: z.string().min(1).max(64),
  nodeName: z.string().max(120).optional(),
  resultB64: z.string().min(1).max(200_000),
  gpuMs: z.number().nonnegative().max(1_000_000).optional(),
})

export const SettleBody = z.object({ jobId: z.string().min(1).max(64) })

export const RegisterBody = z.object({
  id: z.string().max(64).optional(),
  name: z.string().max(120).optional(),
  kind: z.string().max(32).optional(),
  gpuModel: z.string().max(64).optional(),
  region: z.string().max(64).optional(),
})

export const HeartbeatBody = z.object({
  nodeId: z.string().min(1).max(64),
  cpu: z.number().min(0).max(100).optional(),
  gpu: z.number().min(0).max(100).optional(),
  ram: z.number().min(0).max(100).optional(),
  job: z.string().max(120).nullable().optional(),
})

export const NlParseBody = z.object({ prompt: z.string().min(1).max(2000) })

export const TrainingPullBody = z.object({
  nodeId: z.string().min(1).max(64),
  nodeName: z.string().min(1).max(120),
})

export const TrainingContribBody = z.object({
  cellId: z.string().min(1).max(64),
  roundId: z.string().min(1).max(64),
  jobId: z.string().min(1).max(64),
  nodeId: z.string().min(1).max(64),
  nodeName: z.string().max(120).optional(),
  localTheta: z.array(z.number()).min(1).max(4096),
  tokens: z.number().nonnegative().max(1e12).optional(),
  localSteps: z.number().int().nonnegative().max(1e6).optional(),
})

export const TrainingSubmitBody = z.object({
  name: z.string().max(120).optional(),
  baseModel: z.string().max(120).optional(),
  dataset: z.string().max(300).optional(),
  rank: z.number().int().min(1).max(256).optional(),
  hLocalSteps: z.number().int().min(1).max(5000).optional(),
  maxRounds: z.number().int().min(1).max(1000).optional(),
  targetValLoss: z.number().positive().max(100).optional(),
  rewardBid: z.number().positive().max(1_000_000).optional(),
})
