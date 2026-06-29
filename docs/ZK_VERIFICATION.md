# Zero-Knowledge Verification Roadmap

> SP1 zkVM attestation for distributed training contributions (PLAN Phase 5).

## Problem

Today, Mycelia verifies training via **canary-loss spot checks** + **refereed recompute** (O(log n) nodes re-run a slice). This works but requires trust in the referee sample and doesn't give cryptographic guarantees to third parties.

## Target: SP1 Training Attestation

Prove in zero knowledge:

```
public:  θ_before_hash, θ_after_hash, H, seed, loss_after
private: shard data, local SGD trajectory
claim:   θ_after = SGD_H(θ_before, shard, seed)
```

The guest program is a deterministic RISC-V binary mirroring `lib/training/model.ts` localTrain — same reference kernel on server and in the zkVM.

## Proof pipeline

```
Cell completes H local steps
        │
        ▼
┌───────────────────┐
│  Witness builder  │  serialize (θ, shard, H, seed, losses)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  SP1 prover       │  GPU-accelerated (CUDA) or CPU fallback
│  guest: training_ │  ~30s on A100 for H=100, dim=16K LoRA
│  attest.elf       │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  On-chain / coord │  verify proof → accept Δ → pay cell
│  verify (~12ms)   │
└───────────────────┘
```

## Research circuits (non-critical path)

| Circuit | Purpose | Constraints |
|---------|---------|-------------|
| `grad_norm_bound_v0` | Prove ‖Δ‖ < ε without revealing Δ | 2.0M |
| `adapter_merkle_commit_v0` | Commit adapter without opening | 512K |

## Economics

| Mode | Prover cost | Verifier cost | Trust model |
|------|-------------|---------------|-------------|
| Canary-loss (live) | 0 | 1 recompute | Probabilistic |
| Refereed (live) | 0 | O(log n) recompute | Game-theoretic |
| SP1 zk (roadmap) | ~$0.02/proof | ~12ms | Cryptographic |

## Code map

- `lib/zk/sp1-training.ts` — witness + stub prove/verify
- `lib/zk/circuits.ts` — Groth16 research metadata
- `app/api/verify/zk/route.ts` — JSON proof demo
- `crates/mycelia-sp1-guest/` — RISC-V guest (roadmap)

## Status

**Stub only.** No SP1 SDK wired. Canary-loss + refereed recompute remain the live verification path.
