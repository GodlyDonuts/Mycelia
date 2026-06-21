// Typed mock data + domain types for the Requester-facing Marketplace.
//
// Everything here is realistic placeholder data. In production:
//   - JobListing items are streamed from the scheduler's job board feed.
//   - The natural-language intake on the right posts the raw prompt to a
//     Claude structured-output endpoint that returns a validated JobSpec
//     (see parseJobFromPrompt() — currently mocked).
//   - Cost/time estimates come from the pricing oracle keyed on GPU tier,
//     VRAM/RAM, runtime, and replication factor.

export type JobType = "render" | "inference" | "sim" | "lora"
export type GpuTier = "none" | "T4" | "A10G" | "4090" | "A100" | "H100"
export type JobStatus = "open" | "running" | "completed" | "queued"

export type JobListing = {
  id: string
  name: string
  type: JobType
  gpuTier: GpuTier
  /** required VRAM in GB */
  vram: number
  /** required system RAM in GB */
  ram: number
  /** reward in MYC */
  reward: number
  /** ISO timestamp deadline */
  deadline: string
  /** completed tiles/rounds out of total */
  tilesDone: number
  tilesTotal: number
  status: JobStatus
  /** how many cultivator nodes are attached */
  replication: number
  requester: string
}

export const JOB_TYPE_META: Record<
  JobType,
  { label: string; short: string; tint: string; bg: string; border: string }
> = {
  render: { label: "Render", short: "RENDER", tint: "text-chart-2", bg: "bg-chart-2/10", border: "border-chart-2/30" },
  inference: {
    label: "Inference",
    short: "INFER",
    tint: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
  sim: { label: "Simulation", short: "SIM", tint: "text-chart-3", bg: "bg-chart-3/15", border: "border-chart-3/40" },
  lora: {
    label: "LoRA Fine-tune",
    short: "LoRA",
    tint: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/30",
  },
}

export const GPU_TIERS: { value: GpuTier; label: string; vram: number; ram: number }[] = [
  { value: "none", label: "CPU only", vram: 0, ram: 16 },
  { value: "T4", label: "NVIDIA T4", vram: 16, ram: 32 },
  { value: "A10G", label: "NVIDIA A10G", vram: 24, ram: 48 },
  { value: "4090", label: "RTX 4090", vram: 24, ram: 64 },
  { value: "A100", label: "NVIDIA A100", vram: 80, ram: 128 },
  { value: "H100", label: "NVIDIA H100", vram: 80, ram: 192 },
]

export const JOB_STATUS_META: Record<JobStatus, { label: string; tint: string; bg: string; dot: string; live?: boolean }> =
  {
    open: { label: "Open", tint: "text-primary", bg: "bg-primary/10", dot: "bg-primary" },
    running: { label: "Running", tint: "text-status-online", bg: "bg-status-online/10", dot: "bg-status-online", live: true },
    queued: { label: "Queued", tint: "text-status-idle", bg: "bg-status-idle/10", dot: "bg-status-idle" },
    completed: { label: "Completed", tint: "text-tertiary", bg: "bg-secondary", dot: "bg-status-offline" },
  }

const now = Date.now()
const inHours = (h: number) => new Date(now + h * 3600_000).toISOString()

export const JOB_LISTINGS: JobListing[] = [
  {
    id: "job-4471",
    name: "llama-3-8b LoRA · support-bot",
    type: "lora",
    gpuTier: "A100",
    vram: 80,
    ram: 128,
    reward: 1840,
    deadline: inHours(9),
    tilesDone: 12,
    tilesTotal: 32,
    status: "running",
    replication: 3,
    requester: "northwind.ai",
  },
  {
    id: "job-4470",
    name: "4K deep-zoom mandelbrot reel",
    type: "render",
    gpuTier: "4090",
    vram: 24,
    ram: 64,
    reward: 920,
    deadline: inHours(4),
    tilesDone: 184,
    tilesTotal: 256,
    status: "running",
    replication: 6,
    requester: "fractal-studio",
  },
  {
    id: "job-4468",
    name: "sd-xl batch · product shots",
    type: "inference",
    gpuTier: "A10G",
    vram: 24,
    ram: 48,
    reward: 410,
    deadline: inHours(2),
    tilesDone: 0,
    tilesTotal: 500,
    status: "open",
    replication: 0,
    requester: "loomwear",
  },
  {
    id: "job-4465",
    name: "n-body galaxy collision",
    type: "sim",
    gpuTier: "H100",
    vram: 80,
    ram: 192,
    reward: 3120,
    deadline: inHours(36),
    tilesDone: 3,
    tilesTotal: 40,
    status: "running",
    replication: 4,
    requester: "caltech-astro",
  },
  {
    id: "job-4462",
    name: "whisper-v3 transcription run",
    type: "inference",
    gpuTier: "T4",
    vram: 16,
    ram: 32,
    reward: 168,
    deadline: inHours(6),
    tilesDone: 0,
    tilesTotal: 120,
    status: "open",
    replication: 0,
    requester: "podscribe",
  },
  {
    id: "job-4459",
    name: "blender cycles · arch viz",
    type: "render",
    gpuTier: "4090",
    vram: 24,
    ram: 64,
    reward: 640,
    deadline: inHours(18),
    tilesDone: 0,
    tilesTotal: 96,
    status: "queued",
    replication: 0,
    requester: "studio-mono",
  },
  {
    id: "job-4455",
    name: "flux LoRA · brand style",
    type: "lora",
    gpuTier: "A100",
    vram: 80,
    ram: 128,
    reward: 1290,
    deadline: inHours(12),
    tilesDone: 48,
    tilesTotal: 48,
    status: "completed",
    replication: 2,
    requester: "atelier-9",
  },
  {
    id: "job-4451",
    name: "cfd wing turbulence sweep",
    type: "sim",
    gpuTier: "A10G",
    vram: 24,
    ram: 48,
    reward: 760,
    deadline: inHours(28),
    tilesDone: 9,
    tilesTotal: 24,
    status: "running",
    replication: 5,
    requester: "aerolab",
  },
]

// ---- Pricing oracle (mock) ----------------------------------------------

const TIER_RATE: Record<GpuTier, number> = {
  none: 0.4,
  T4: 1.1,
  A10G: 2.2,
  "4090": 2.8,
  A100: 6.5,
  H100: 11.0,
}

export type CostEstimate = {
  /** total MYC for the run */
  myc: number
  /** approx USD */
  usd: number
  /** estimated wall-clock minutes */
  minutes: number
  /** suggested fair-market reward bid */
  suggestedBid: number
}

/**
 * Mock pricing oracle. In production this is a server call that factors in
 * current network supply/demand, node availability for the tier, and the
 * replication factor.
 */
export function estimateCost(input: {
  gpuTier: GpuTier
  vram: number
  ram: number
  maxRuntimeMin: number
  replication: number
}): CostEstimate {
  const rate = TIER_RATE[input.gpuTier] ?? 1
  const resourceFactor = 1 + input.vram / 200 + input.ram / 512
  const replication = Math.max(1, input.replication)
  const runtimeHours = Math.max(1, input.maxRuntimeMin) / 60
  const myc = Math.round(rate * 60 * runtimeHours * resourceFactor * replication)
  const minutes = Math.round(input.maxRuntimeMin / Math.min(replication, 4))
  return {
    myc,
    usd: Math.round(myc * 0.12 * 100) / 100,
    minutes,
    suggestedBid: Math.round(myc * 1.08),
  }
}

// ---- Natural-language intake (mocked Claude structured output) ----------

export type JobFormState = {
  name: string
  type: JobType
  image: string
  datasetUrl: string
  gpuTier: GpuTier
  vram: number
  ram: number
  maxRuntimeMin: number
  replication: number
  rewardBid: number
}

export const EMPTY_JOB: JobFormState = {
  name: "",
  type: "inference",
  image: "",
  datasetUrl: "",
  gpuTier: "A10G",
  vram: 24,
  ram: 48,
  maxRuntimeMin: 60,
  replication: 1,
  rewardBid: 0,
}

export const EXAMPLE_PROMPTS: string[] = [
  "Fine-tune a LoRA on this dataset under $5",
  "Render a 4K deep-zoom fractal",
  "Run whisper-v3 transcription on 200 audio files",
  "Simulate an n-body galaxy collision overnight",
]

/**
 * MOCK of the Claude structured-output endpoint.
 *
 * In production: POST { prompt } to /jobs/parse, which calls Claude with a
 * JSON schema (generateObject) and returns a *validated* JobSpec. The model
 * maps plain English → typed fields, infers a sensible GPU tier, and proposes
 * a reward bid that respects any budget mentioned in the prompt.
 *
 * Here we pattern-match a few keywords so the demo fills believably.
 */
export function parseJobFromPrompt(prompt: string): JobFormState {
  const p = prompt.toLowerCase()
  const base = { ...EMPTY_JOB }

  if (p.includes("lora") || p.includes("fine-tune") || p.includes("finetune") || p.includes("train")) {
    base.type = "lora"
    base.name = "llama-3-8b LoRA fine-tune"
    base.image = "ghcr.io/mycelia/axolotl:0.4"
    base.datasetUrl = "s3://my-bucket/dataset.jsonl"
    base.gpuTier = "A100"
    base.vram = 80
    base.ram = 128
    base.maxRuntimeMin = 120
    base.replication = 2
  } else if (p.includes("render") || p.includes("fractal") || p.includes("4k") || p.includes("blender")) {
    base.type = "render"
    base.name = p.includes("fractal") ? "4K deep-zoom fractal reel" : "4K render batch"
    base.image = "ghcr.io/mycelia/blender-cycles:4.1"
    base.datasetUrl = "s3://my-bucket/scene.blend"
    base.gpuTier = "4090"
    base.vram = 24
    base.ram = 64
    base.maxRuntimeMin = 90
    base.replication = 4
  } else if (p.includes("sim") || p.includes("galaxy") || p.includes("n-body") || p.includes("cfd")) {
    base.type = "sim"
    base.name = "n-body galaxy collision"
    base.image = "ghcr.io/mycelia/gadget4:latest"
    base.datasetUrl = "s3://my-bucket/ic.hdf5"
    base.gpuTier = "H100"
    base.vram = 80
    base.ram = 192
    base.maxRuntimeMin = 480
    base.replication = 4
  } else {
    base.type = "inference"
    base.name = p.includes("whisper") ? "whisper-v3 transcription" : "inference batch"
    base.image = "ghcr.io/mycelia/vllm:0.6"
    base.datasetUrl = "s3://my-bucket/inputs/"
    base.gpuTier = "A10G"
    base.vram = 24
    base.ram = 48
    base.maxRuntimeMin = 45
    base.replication = 1
  }

  // budget-aware bid: if a "$N" appears, respect it (×8.3 MYC/USD); else estimate.
  const budgetMatch = p.match(/\$\s?(\d+(?:\.\d+)?)/)
  const est = estimateCost(base)
  if (budgetMatch) {
    base.rewardBid = Math.round(Number(budgetMatch[1]) * 8.3)
  } else {
    base.rewardBid = est.suggestedBid
  }
  return base
}
