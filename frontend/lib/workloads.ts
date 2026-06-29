// The workload-class registry (Phase 6: generalize beyond the fractal hero).
// Each class declares how its results are verified — the verification primitive
// is per-workload (PLAN §8), which is the whole point of the trust layer.

export interface WorkloadClass {
  id: string
  label: string
  verify: string
  status: "live" | "roadmap"
  note: string
}

export const WORKLOADS: WorkloadClass[] = [
  { id: "render", label: "Deep-zoom fractal render", verify: "deterministic self-check + refereed recompute", status: "live", note: "the hero — deterministic, image output, fan-out + reassembly" },
  { id: "montecarlo", label: "Monte Carlo (π / sims)", verify: "reseed recompute (bitwise)", status: "live", note: "seeded RNG ⇒ deterministic ⇒ trivially verifiable" },
  { id: "lora", label: "LoRA fine-tune (training)", verify: "canary-loss + reputation (refereed roadmap)", status: "live", note: "data-parallel DiLoCo/FedAvg across cells" },
  { id: "inference", label: "Batched inference", verify: "reseed recompute (deterministic classifier)", status: "live", note: "fixed model over seeded batches ⇒ bitwise-verifiable" },
  { id: "render3d", label: "3D / video rendering", verify: "escrow-until-validated + spot-check", status: "roadmap", note: "Render-network-style proof-of-render" },
  { id: "etl", label: "Data ETL / scraping", verify: "redundant agreement", status: "roadmap", note: "public-data only (no usable TEE on consumer HW)" },
  { id: "pipeline-70b", label: "Pipeline-parallel LLM (70B+)", verify: "activation checksum + refereed stage recompute", status: "roadmap", note: "Regime 2 — WebRTC activation transport between stages" },
  { id: "tensor-parallel", label: "Tensor-parallel shard (TP≥2)", verify: "ring-allreduce commit + grad-norm bound", status: "roadmap", note: "Intra-cell NCCL over LAN; ring fallback over WAN" },
  { id: "zk-attest", label: "SP1 zk training attestation", verify: "succinct proof of local SGD", status: "roadmap", note: "Replaces canary-loss with cryptographic guarantee" },
  { id: "pretrain", label: "Full model pretraining", verify: "checkpoint Merkle + zk grad attestation", status: "roadmap", note: "Requires Regime-2 cells + multi-week job orchestration" },
  { id: "federated", label: "Cross-silo federated LoRA", verify: "DiLoCo outer + differential privacy noise audit", status: "roadmap", note: "Enterprise data stays local; only adapter deltas cross wire" },
]
