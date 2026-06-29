# Mycelia Distributed Training Stack

> Architecture overview for judges / investors. See individual docs for depth.

## Layer cake

```
┌─────────────────────────────────────────────────────────────────┐
│  UI: Network · Cloud · Trust · Health                           │
├─────────────────────────────────────────────────────────────────┤
│  API: /training/* · /p2p/* · /verify/zk · /models             │
├─────────────────────────────────────────────────────────────────┤
│  Coordinator: DiLoCo outer · cell membership · escrow ledger    │
├──────────────┬──────────────────────┬───────────────────────────┤
│  Regime 1    │  Regime 2            │  Verification             │
│  Data-par    │  Pipeline / Tensor   │  Canary · Refereed · ZK   │
│  LoRA cells  │  P2P activations     │  SP1 attestation          │
├──────────────┴──────────────────────┴───────────────────────────┤
│  Workers: browser · daemon · Python SDK · Rust cell · PyTorch   │
├─────────────────────────────────────────────────────────────────┤
│  Infra: PGlite → Aurora DSQL · TURN relay · S3 checkpoints      │
└─────────────────────────────────────────────────────────────────┘
```

## File tree (training-critical paths)

| Path | Lines | Purpose |
|------|-------|---------|
| `frontend/lib/training/` | 15 modules | LoRA kernel, DiLoCo, PP/TP proofs, compression |
| `frontend/lib/p2p/` | 3 modules | WebRTC mesh, ICE, bandwidth estimation |
| `frontend/lib/zk/` | 2 modules | SP1 attestation + research circuits |
| `frontend/lib/distributed/` | 2 modules | Membership, partition tolerance |
| `frontend/lib/models/` | 2 modules | HF registry, Megatron shard specs |
| `proto/` | 2 protos | gRPC coordinator + signaling |
| `schemas/` | 2 JSON schemas | Job + cell topology |
| `configs/training/` | 2 YAML | Llama 8B LoRA + 70B pipeline |
| `sdk/python/` | SDK | Production worker client |
| `crates/mycelia-cell/` | Rust | Native high-throughput cell |
| `crates/mycelia-sp1-guest/` | Rust | zkVM guest binary |
| `examples/` | 3 workers | numpy, PyTorch, pipeline stage |
| `daemon/` | 4 scripts | supply engine + training cell + relay |
| `infra/` | TF + K8s + monitoring | AWS topology |

## What's real vs roadmap

| Component | Status |
|-----------|--------|
| LoRA data-parallel training | **Live** — loss curve drops in UI |
| Pipeline/tensor proofs | **Live** — grad-equivalent to monolithic |
| Delta compression | **Live** — top-k + int8 + error feedback |
| Refereed recompute | **Live** — O(log n) verification |
| WebRTC P2P activations | Roadmap — signaling + wire budget modeled |
| SP1 zk proofs | Roadmap — stub prove/verify |
| Aurora DSQL | Roadmap — PGlite swap point ready |
| PyTorch worker | Reference — falls back to numpy |
| Rust cell | Reference — compiles, pulls rounds |

## Quick demo endpoints

```bash
curl localhost:3000/api/training/diloco
curl localhost:3000/api/training/pipeline
curl localhost:3000/api/training/transport
curl localhost:3000/api/p2p/mesh
curl localhost:3000/api/verify/zk
curl localhost:3000/api/models
```
