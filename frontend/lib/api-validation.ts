import type {
  ParseJobRequest,
  PullWorkRequest,
  SettleRequest,
  SubmitRequest,
  SubmitResultRequest,
} from "@/lib/api-contracts"
import type { GpuTier, JobFormState, JobType } from "@/lib/marketplace-data"

const JOB_TYPES: JobType[] = ["render", "inference", "sim", "lora"]
const GPU_TIERS: GpuTier[] = ["none", "T4", "A10G", "4090", "A100", "H100"]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0
}

function validateJobSpec(value: unknown, prefix = "spec") {
  const errors: string[] = []

  if (!isObject(value)) {
    return [`${prefix} must be an object`]
  }

  if (!isNonEmptyString(value.name)) errors.push(`${prefix}.name is required`)
  if (!JOB_TYPES.includes(value.type as JobType)) errors.push(`${prefix}.type is invalid`)
  if (!isNonEmptyString(value.image)) errors.push(`${prefix}.image is required`)
  if (!isString(value.datasetUrl)) errors.push(`${prefix}.datasetUrl must be a string`)
  if (!GPU_TIERS.includes(value.gpuTier as GpuTier)) errors.push(`${prefix}.gpuTier is invalid`)
  if (!isNumber(value.vram) || value.vram < 0) errors.push(`${prefix}.vram must be >= 0`)
  if (!isPositiveNumber(value.ram)) errors.push(`${prefix}.ram must be > 0`)
  if (!isPositiveNumber(value.maxRuntimeMin)) errors.push(`${prefix}.maxRuntimeMin must be > 0`)
  if (!isPositiveNumber(value.replication)) errors.push(`${prefix}.replication must be > 0`)
  if (!isPositiveNumber(value.rewardBid)) errors.push(`${prefix}.rewardBid must be > 0`)

  return errors
}

function validateEstimate(value: unknown, prefix = "estimate") {
  const errors: string[] = []

  if (!isObject(value)) {
    return [`${prefix} must be an object`]
  }

  if (!isNumber(value.myc) || value.myc < 0) errors.push(`${prefix}.myc must be >= 0`)
  if (!isNumber(value.usd) || value.usd < 0) errors.push(`${prefix}.usd must be >= 0`)
  if (!isPositiveNumber(value.minutes)) errors.push(`${prefix}.minutes must be > 0`)
  if (!isNumber(value.suggestedBid) || value.suggestedBid < 0) errors.push(`${prefix}.suggestedBid must be >= 0`)

  return errors
}

export function validateSubmitRequest(value: unknown): value is SubmitRequest {
  return getSubmitRequestErrors(value).length === 0
}

export function getSubmitRequestErrors(value: unknown) {
  if (!isObject(value)) return ["body must be an object"]

  return [...validateJobSpec(value.spec as JobFormState), ...validateEstimate(value.estimate)]
}

export function validateParseJobRequest(value: unknown): value is ParseJobRequest {
  return isObject(value) && isNonEmptyString(value.prompt)
}

export function getParseJobRequestDetails(value: unknown) {
  if (!isObject(value)) return ["body must be an object"]
  if (!isNonEmptyString(value.prompt)) return ["prompt is required"]
  return []
}

export function getPullWorkRequestErrors(value: unknown) {
  if (!isObject(value)) return ["body must be an object"]

  const errors: string[] = []
  if (!isNonEmptyString(value.nodeId)) errors.push("nodeId is required")
  if (!isNonEmptyString(value.capabilityClass)) errors.push("capabilityClass is required")
  return errors
}

export function validatePullWorkRequest(value: unknown): value is PullWorkRequest {
  return getPullWorkRequestErrors(value).length === 0
}

export function getSubmitResultRequestErrors(value: unknown) {
  if (!isObject(value)) return ["body must be an object"]

  const errors: string[] = []
  if (!isNonEmptyString(value.tileId)) errors.push("tileId is required")
  if (!isNonEmptyString(value.resultHash)) errors.push("resultHash is required")
  return errors
}

export function validateSubmitResultRequest(value: unknown): value is SubmitResultRequest {
  return getSubmitResultRequestErrors(value).length === 0
}

export function getSettleRequestErrors(value: unknown) {
  if (!isObject(value)) return ["body must be an object"]
  if (!isNonEmptyString(value.jobId)) return ["jobId is required"]
  return []
}

export function validateSettleRequest(value: unknown): value is SettleRequest {
  return getSettleRequestErrors(value).length === 0
}
