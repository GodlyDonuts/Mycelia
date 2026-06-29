// Open-model registry for LoRA fine-tune jobs (HuggingFace lineage metadata).

export interface ModelEntry {
  id: string
  label: string
  paramsB: number
  contextLen: number
  vramMinGb: number
  loraTargets: string[]
  license: string
  status: "supported" | "experimental" | "roadmap"
}

export const MODEL_REGISTRY: ModelEntry[] = [
  {
    id: "meta-llama/Llama-3.2-1B",
    label: "Llama 3.2 1B",
    paramsB: 1,
    contextLen: 8192,
    vramMinGb: 4,
    loraTargets: ["q_proj", "v_proj"],
    license: "Llama-3.2",
    status: "supported",
  },
  {
    id: "meta-llama/Llama-3.1-8B",
    label: "Llama 3.1 8B",
    paramsB: 8,
    contextLen: 8192,
    vramMinGb: 10,
    loraTargets: ["q_proj", "k_proj", "v_proj", "o_proj"],
    license: "Llama-3.1",
    status: "supported",
  },
  {
    id: "meta-llama/Llama-3.1-70B",
    label: "Llama 3.1 70B",
    paramsB: 70,
    contextLen: 8192,
    vramMinGb: 48,
    loraTargets: ["q_proj", "v_proj"],
    license: "Llama-3.1",
    status: "experimental",
  },
  {
    id: "mistralai/Mistral-7B-v0.3",
    label: "Mistral 7B v0.3",
    paramsB: 7,
    contextLen: 32768,
    vramMinGb: 10,
    loraTargets: ["q_proj", "v_proj"],
    license: "Apache-2.0",
    status: "supported",
  },
  {
    id: "deepseek-ai/DeepSeek-V2-Lite",
    label: "DeepSeek V2 Lite (MoE)",
    paramsB: 16,
    contextLen: 32768,
    vramMinGb: 24,
    loraTargets: ["q_proj", "v_proj", "shared_experts"],
    license: "DeepSeek",
    status: "roadmap",
  },
]

export function findModel(id: string): ModelEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id)
}

export function loraParamCount(hidden: number, rank: number, targets: number): number {
  return 2 * hidden * rank * targets
}
