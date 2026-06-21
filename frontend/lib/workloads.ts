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
]
