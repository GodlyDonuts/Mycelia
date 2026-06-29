# DiLoCo vs FedAvg vs ZeRO — Decision Record

**Status:** Accepted  
**Date:** 2026-03-15  
**Authors:** Mycelia ML team

## Context

Mycelia cells are heterogeneous consumer GPUs on home internet. We need an outer-loop optimizer that:

1. Tolerates 50–500 local steps between WAN syncs
2. Ships only adapter deltas (MB, not GB)
3. Converges on LoRA fine-tune tasks

## Options considered

| Approach | WAN sync freq | Bytes/round | Heterogeneity |
|----------|---------------|-------------|---------------|
| FedAvg | Every step | Full adapter | Poor (stragglers block) |
| DiLoCo | Every H steps | Pseudo-grad | Good (capability-weighted) |
| ZeRO-3 + NCCL | Every step | Sharded states | Requires LAN |

## Decision

**DiLoCo outer optimizer** with H=100 default, capability-weighted pseudo-gradient aggregation.

Inner cell sync (tensor/pipeline parallel) uses ring-allreduce when NCCL unavailable.

## Consequences

- `lib/training/diloco.ts` implements outer Nesterov step
- `configs/training/*.yaml` expose H, outerLr, compressionK
- FedAvg remains available as `H=1` degenerate case

## Validation

Demo adapter (dim=16) converges under DiLoCo with 3 simulated cells; validation loss monotonically decreases over 50 rounds in the live UI.
