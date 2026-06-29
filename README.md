<div align="center">

# Mycelia

### *The planetary nervous system for distributed intelligence.*

**Weave idle consumer GPUs into a living compute organism — and train the next generation of AI on it.**

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-6fd3b8?style=flat-square)](#test)
[![Stack](https://img.shields.io/badge/Stack-Next.js%2016%20·%20React%2019%20·%20PGlite-d8a25a?style=flat-square)](#run-it)
[![Training](https://img.shields.io/badge/Training-DiLoCo%20·%20LoRA%20·%20PP%2FTP-6fd3b8?style=flat-square)](docs/ML_LAYER.md)
[![Verify](https://img.shields.io/badge/Verify-Canary%20·%20Refereed%20·%20ZK-d8a25a?style=flat-square)](docs/ZK_VERIFICATION.md)

*54 API routes · 17 training modules · 2 Rust crates · gRPC protos · multi-region Terraform · 92 unit tests*

[Run it](#run-it) · [Architecture](#architecture) · [Training stack](#the-distributed-training-stack) · [Verification moat](#verification-at-planetary-scale) · [Docs](#documentation)

</div>

---

## The thesis

Hyperscalers are building **$100B datacenters** to train models that won't fit in your pocket. Meanwhile, **hundreds of millions of gaming PCs and laptops** sit 85–90% idle — already powered, already cooled, already on the internet.

**Mycelia closes that gap.**

We are building the world's first **trust-native, economics-first distributed training fabric** — a two-sided marketplace where everyday people contribute idle compute and earn **MYC credits**, while researchers fine-tune **70B-parameter models** at a fraction of hyperscaler cost. Not by pretending consumer hardware is a datacenter. By **architecting around heterogeneity**: rare WAN-friendly adapter syncs, aggressive communication compression, cryptographic verification of every contribution, and a cell abstraction that scales from one laptop to a pipeline of co-located GPUs.

> *Many small nodes. One living organism. The mycelium doesn't ask permission from the forest floor.*

This repo is the **full stack** — coordinator, ledger, verification moat, P2P transport layer, zk attestation pipeline, native workers in Python and Rust, and the infra to deploy it globally. The hackathon MVP runs locally with zero AWS; every production path is stubbed, documented, and one swap away from live.

---

## What makes this different

| Hyperscaler cloud | BOINC / Folding@home | **Mycelia** |
|---|---|---|
| Centralized, expensive, scarce | Volunteer, unverifiable, no economics | **Marketplace + escrow + verification moat** |
| All-reduce every step over InfiniBand | No training | **DiLoCo: sync every H steps over home internet** |
| Trust the provider | Trust nobody, verify nothing | **Canary-loss → refereed recompute → SP1 zk proofs** |
| One GPU per job | One kernel per job | **Two-level parallelism: data-par across cells, PP/TP within** |
| Pay whether or not it worked | Free but useless for ML | **Pay only for verified contributions** |

---

## Architecture

```
                         ┌─────────────────────────────────────────┐
                         │           REQUESTERS & AGENTS           │
                         │  NL submit · MCP tools · REST · SDK     │
                         └────────────────────┬────────────────────┘
                                              │
    ┌─────────────────────────────────────────▼─────────────────────────────────────────┐
    │                        CONTROL PLANE (Coordinator)                                 │
    │  Escrow ledger · DiLoCo outer loop · Cell membership · Job fan-out · Settlement   │
    │  PGlite today ──────────────────────────────────────────────▶ Aurora DSQL tomorrow   │
    └──────────────┬──────────────────────────────┬──────────────────────┬──────────────┘
                   │                              │                      │
         ┌─────────▼─────────┐          ┌─────────▼─────────┐   ┌────────▼────────┐
         │   REGIME 1        │          │   REGIME 2         │   │  VERIFICATION   │
         │   Data-parallel   │          │   Model-sharded    │   │  TRUST LAYER    │
         │                   │          │                    │   │                 │
         │  Cell = 1 GPU     │          │  Cell = pipeline   │   │  Canary-loss    │
         │  LoRA / QLoRA     │          │  of 2–8 nodes      │   │  Refereed O(logn│
         │  Δ every H steps  │          │  Activations P2P   │   │  SP1 zk attest  │
         │  top-k + int8     │          │  WebRTC + TURN     │   │  Stake + slash  │
         └─────────┬─────────┘          └─────────┬─────────┘   └────────┬────────┘
                   │                              │                      │
    ┌──────────────┴──────────────────────────────┴──────────────────────┴──────────────┐
    │                              COMPUTE SUPPLY LAYER                                  │
    │                                                                                    │
    │   Browser (WebGPU)   Native daemon   Python SDK   Rust cell   PyTorch worker      │
    │   Fractal · MC ·     Multicore CPU   numpy/torch  tokio/      PEFT + bnb          │
    │   LoRA training      harvest         pull/submit  ndarray     pipeline stages     │
    └────────────────────────────────────────────────────────────────────────────────────┘
```

### Request flow

```
Client (poll + POST)
    │
    ▼
app/api/*  ──►  lib/coordinator.ts (writes)  /  lib/reads.ts (reads)
    │                    │
    │                    ▼
    │              lib/db/index.ts  ◄── ONE shared connection (PGlite → DSQL swap)
    │
    ▼
lib/driver.ts  ── in-process simulator keeping the mesh alive
lib/fractal.ts ── deterministic kernel (identical server + browser)
lib/training/* ── LoRA kernel, DiLoCo, PP/TP proofs, compression, transport
```

Full reference: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Training deep-dive: [`docs/ML_LAYER.md`](docs/ML_LAYER.md) · Stack map: [`docs/TRAINING_STACK.md`](docs/TRAINING_STACK.md)

---

## The distributed training stack

Mycelia's ML layer is not a slide deck. It is **17 modules, 15 training API routes, 2 protobuf services, 2 JSON schemas, 2 YAML job configs, a Python SDK, and two Rust crates** — all cross-referenced to a single design doc.

### Two levels of splitting

The entire design rests on one insight: **split data often, split models only when forced.**

```
TRAINING JOB: fine-tune LoRA adapter θ on dataset D  (base model frozen, 4-bit)
                              │
          ┌───────────────────┴───────────────────────┐
          │  OUTER LOOP — data-parallel across CELLS    │
          │  Ship adapter deltas every H=100 steps      │
          │  top-k + int8 + error feedback (~50× smaller)│
          └───────────────────┬───────────────────────┘
            ┌─────────┬───────┴───────┬─────────────────────┐
            ▼         ▼               ▼                     ▼
       ┌─────────┐ ┌─────────┐  ┌─────────┐      ┌──────────────────┐
       │ Cell A  │ │ Cell B  │  │ Cell C  │      │ Cell D (ROADMAP) │
       │ 1×4090  │ │ 1×3060  │  │ laptop  │      │ 4-stage pipeline │
       │ shard 1 │ │ shard 2 │  │ shard 3 │      │ Llama 70B        │
       └────┬────┘ └────┬────┘  └────┬────┘      └────────┬─────────┘
            │    H local steps each  │                    │
            └──────────┬─────────────┴────────────────────┘
                       ▼
              DiLoCo outer optimizer
              capability-weighted Δ merge
              validation loss ↓ → pay accepted cells
```

**Regime 1** (live): one GPU per cell, pure data-parallel LoRA — the hero demo with a real validation-loss drop on the Network screen.

**Regime 2** (proof-complete, wire roadmap): pipeline/tensor parallel within a cell — activations cross WebRTC DataChannels; gradients proven **bit-identical to monolithic** in-process.

### Training module map

| Module | Purpose |
|--------|---------|
| [`model.ts`](frontend/lib/training/model.ts) | Tiny LoRA adapter + deterministic `localTrain()` |
| [`coordinator.ts`](frontend/lib/training/coordinator.ts) | Round orchestration, canary-loss, payouts |
| [`diloco.ts`](frontend/lib/training/diloco.ts) | Outer Nesterov optimizer, H-step sync |
| [`compress.ts`](frontend/lib/training/compress.ts) | Top-k + int8 + error feedback (DeMo/DisTrO lineage) |
| [`pipeline.ts`](frontend/lib/training/pipeline.ts) | 2-stage MLP pipeline proof — grad-equivalent to monolithic |
| [`tensor.ts`](frontend/lib/training/tensor.ts) | Column/row tensor parallel proof |
| [`partition.ts`](frontend/lib/training/partition.ts) | Heterogeneity-aware stage partitioning |
| [`ring-allreduce.ts`](frontend/lib/training/ring-allreduce.ts) | Intra-cell gradient sync (NCCL fallback) |
| [`transport.ts`](frontend/lib/training/transport.ts) | Activation wire budget + envelope ordering |
| [`heterogeneity.ts`](frontend/lib/training/heterogeneity.ts) | Capability-weighted shard assignment |
| [`checkpointing.ts`](frontend/lib/training/checkpointing.ts) | Content-addressed adapter snapshots |
| [`dataloader.ts`](frontend/lib/training/dataloader.ts) | Deterministic shards for refereed recompute |
| [`mixed-precision.ts`](frontend/lib/training/mixed-precision.ts) | QLoRA bf16/fp32 policy |
| [`activation-offload.ts`](frontend/lib/training/activation-offload.ts) | ZeRO-Offload for VRAM-constrained nodes |
| [`gossip.ts`](frontend/lib/training/gossip.ts) | Epidemic delta propagation (partition fallback) |
| [`refereed.ts`](frontend/lib/training/refereed.ts) | Training-specific O(log n) recompute |
| [`driver.ts`](frontend/lib/training/driver.ts) | In-process simulated training cells |

### P2P + transport layer

Pipeline stages don't talk through the coordinator for activations — that would melt the control plane. They talk **peer-to-peer**:

| Module | Role |
|--------|------|
| [`webrtc-mesh.ts`](frontend/lib/p2p/webrtc-mesh.ts) | Signaling session lifecycle, SDP exchange |
| [`ice-config.ts`](frontend/lib/p2p/ice-config.ts) | STUN/TURN bundles per region |
| [`bandwidth-estimator.ts`](frontend/lib/p2p/bandwidth-estimator.ts) | Adaptive int8 vs fp16 on constrained uplinks |

Proto: [`proto/p2p/v1/signaling.proto`](proto/p2p/v1/signaling.proto) · Daemon relay: [`daemon/p2p-relay.mjs`](daemon/p2p-relay.mjs)

### Zero-knowledge attestation

| Module | Role |
|--------|------|
| [`sp1-training.ts`](frontend/lib/zk/sp1-training.ts) | Witness builder + stub prove/verify |
| [`circuits.ts`](frontend/lib/zk/circuits.ts) | Groth16 research circuits (grad-norm bounds) |
| [`crates/mycelia-sp1-guest/`](crates/mycelia-sp1-guest/) | RISC-V guest binary for SP1 zkVM |

Route: `GET /api/verify/zk` · ADR: [`docs/adr/003-sp1-training-attestation.md`](docs/adr/003-sp1-training-attestation.md)

---

## Verification at planetary scale

Untrusted nodes lie. Mycelia's moat is **per-workload verification primitives** with escalating guarantees:

```
                    ┌─────────────────────────────────┐
                    │   L3: SP1 zkVM attestation      │  Cryptographic proof of
                    │   "I ran H steps of SGD"        │  local SGD (roadmap)
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
                    │   L2: Refereed delegation       │  O(log n) recompute —
                    │   Binary search → first diverge │  64× cheaper than full
                    └───────────────┬─────────────────┘  (live: fractal + training)
                                    │
                    ┌───────────────▼─────────────────┐
                    │   L1: Deterministic self-check  │  Reseed/recompute —
                    │   + canary-loss (training)      │  bitwise or loss-bound
                    └───────────────┬─────────────────┘  (live: all workloads)
                                    │
                    ┌───────────────▼─────────────────┐
                    │   L0: Stake + reputation +      │  Economic deterrence —
                    │   slashing on failed challenge  │  spot-check rate scales
                    └─────────────────────────────────┘  with reputation (live)
```

**Escrow-until-verified** on every workload: requesters prepay into escrow atomically (no overdraft race); contributors are paid **only** when verification passes; settlement is idempotent.

---

## What's live right now

This is not a mockup. The following run **today**, locally, with zero cloud provisioning:

### Compute & rendering
- **Live coordinator** — `/submit`, `/pull-work`, `/submit-result`, `/settle` as stateless handlers with 40001 OCC retry
- **Real distributed fractal render** — deterministic deep-zoom Mandelbrot fans out across simulated fleet **and** real browser WebGPU/CPU workers; tiles reassemble into one image on the Network screen
- **"Join the mesh" browser worker** — zero install, WGSL compute shader with per-tile GPU timing telemetry
- **Native daemon** — [`daemon/mycelia-daemon.mjs`](daemon/mycelia-daemon.mjs) harvests idle multicore CPU via worker threads; launchd/systemd install scripts included

### Distributed training
- **Converging LoRA fine-tune** — frozen base + trainable adapter, DiLoCo/FedAvg outer loop, **canary-loss rejects bad deltas**, token-weighted payouts; live validation-loss chart on Network screen
- **Pipeline + tensor parallel proofs** — gradients proven equivalent to monolithic single-node (`maxGradDiff < 1e-9`)
- **Communication compression** — top-k + int8 + error feedback; convergence preserved (unit-tested)
- **External workers** — open pull/contribute API; [`examples/train_worker.py`](examples/train_worker.py), [`train_worker_pytorch.py`](examples/train_worker_pytorch.py), [`pipeline_stage_worker.py`](examples/pipeline_stage_worker.py)

### Trust, economics, platform
- **Stake / reputation / slashing** — failed challenges slash stake and raise spot-check rate; Trust screen shows live unit economics (+$0.084/node-hour proven path)
- **Refereed-delegation recompute** — O(log n) verification, live on Trust screen
- **7 workload classes** — fractal, Monte Carlo, LoRA, inference, 3D render, ETL, pipeline-70B, tensor-parallel, zk-attest, pretrain, federated ([`lib/workloads.ts`](frontend/lib/workloads.ts))
- **Auth + roles** — HMAC sessions, provider/requester RBAC, submit gated server-side
- **Capability sandbox** — untrusted kernels in denied `node:vm` slice with hard time cap
- **MYC redemption** — bank/gift-card/crypto cash-out with KYC disclosure
- **Read-only MCP server** — 7 agent tools over JSON-RPC (`/api/mcp`)
- **NL job submission** — Claude Opus structured output → Zod re-validation → `/submit`; keyword fallback without API key
- **Multi-region payouts** — region-weighted settlement ([`lib/regions.ts`](frontend/lib/regions.ts))
- **Cloud console** — architecture diagram + DSQL status ([`/cloud`](frontend/app/cloud/page.tsx))

### Hardening & observability
- Zod validation on every write endpoint + token-bucket rate limiting
- Ledger reconciliation sweep — proves no overdraft, escrow covers all pending payouts
- Health strip — tile status, mesh liveness, trust counters, per-worker heartbeat
- **92 Vitest unit tests** + **live smoke integration** — both in CI

---

## Repository map

```
Mycelia/
├── frontend/                    # Next.js 16 App Router — the entire MVP
│   ├── app/api/                 # 54 route handlers (coordinator, training, p2p, zk, mcp…)
│   ├── lib/
│   │   ├── training/            # 17 modules — the ML layer
│   │   ├── p2p/                 # WebRTC mesh, ICE, bandwidth estimator
│   │   ├── zk/                  # SP1 attestation + circuit metadata
│   │   ├── distributed/         # Cell membership, partition tolerance
│   │   ├── models/              # HF registry, Megatron shard specs
│   │   ├── db/                  # PGlite bootstrap, schema, seed, OCC retry
│   │   └── …                    # coordinator, referee, verification, wallet, sandbox
│   ├── components/              # 7 screens + cloud console + shadcn/ui
│   └── test/                    # 19 unit files + smoke.mjs + fuzz.mjs
├── daemon/                      # Native supply engine + training cell + P2P relay
├── crates/
│   ├── mycelia-cell/            # Rust training worker (tokio + reqwest + ndarray)
│   └── mycelia-sp1-guest/       # SP1 zkVM RISC-V guest binary
├── sdk/python/mycelia/          # Production Python client + compress_topk
├── proto/                       # gRPC: coordinator + WebRTC signaling
├── schemas/                     # JSON Schema: training-job, cell-topology
├── configs/training/            # Llama 8B LoRA + 70B pipeline YAML
├── infra/
│   ├── terraform/               # Aurora DSQL, TURN Fargate, multi-region
│   ├── k8s/                     # Coordinator Deployment, coturn DaemonSet
│   └── monitoring/              # Prometheus alert rules
├── examples/                    # numpy, PyTorch, pipeline stage workers
├── docs/                        # ARCHITECTURE, ML_LAYER, TRANSPORT, ZK, ADRs…
├── PLAN.md                      # Master plan (Phases 0–6)
└── CLAUDE.md                    # Agent quickstart
```

---

## API surface

<details>
<summary><strong>Coordinator & marketplace (14 routes)</strong></summary>

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/submit` | POST | Submit job → escrow debit |
| `/api/pull-work` | POST | Claim tile (40001-safe) |
| `/api/submit-result` | POST | Submit tile result |
| `/api/settle` | POST | Idempotent settlement |
| `/api/marketplace` | GET | Job board |
| `/api/jobs/parse` | POST | NL → JobSpec |
| `/api/nodes/register` | POST | Join mesh |
| `/api/heartbeat` | POST | Liveness |
| `/api/network` | GET | Mesh topology |
| `/api/network/stream` | GET | SSE tile stream |
| `/api/stats` | GET | Global stats |
| `/api/dashboard` | GET | Dashboard aggregate |
| `/api/ledger` | GET | Ledger entries |
| `/api/regions` | GET | Region config |

</details>

<details>
<summary><strong>Distributed training (15 routes)</strong></summary>

| Route | Purpose |
|-------|---------|
| `/api/training/pull` | Pull training round |
| `/api/training/submit-contribution` | Submit adapter Δ |
| `/api/training/active` | Active training job |
| `/api/training/adapter` | Current adapter weights |
| `/api/training/comms` | Compression budget metrics |
| `/api/training/pipeline` | PP grad-equivalence proof |
| `/api/training/tensor` | TP grad-equivalence proof |
| `/api/training/diloco` | Outer optimizer demo |
| `/api/training/ring` | Ring all-reduce metrics |
| `/api/training/transport` | Activation wire budget |
| `/api/training/sharding` | Heterogeneity-aware shards |
| `/api/training/checkpoints` | Adapter snapshots |
| `/api/training/dataloader` | Deterministic shard iterator |
| `/api/training/metrics` | OTel/Prometheus export |
| `/api/training/referee` · `/serving` | Refereed + inference serve |

</details>

<details>
<summary><strong>P2P, verification, models, platform (25 routes)</strong></summary>

| Group | Routes |
|-------|--------|
| **P2P** | `/api/p2p/mesh`, `/api/p2p/bwe` |
| **ZK** | `/api/verify/zk`, `/api/verify/referee`, `/api/verify/replication` |
| **Distributed** | `/api/distributed/membership` |
| **Models** | `/api/models` |
| **Workloads** | `/api/inference`, `/api/montecarlo`, `/api/render3d`, `/api/etl` |
| **Trust** | `/api/verification`, `/api/wallet`, `/api/wallet/redeem` |
| **Auth** | `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` |
| **Ops** | `/api/health`, `/api/cloud`, `/api/sandbox/demo`, `/api/mcp` |

</details>

### Quick proof curls

```bash
cd frontend && pnpm dev   # http://localhost:3000

curl localhost:3000/api/training/pipeline    # PP grad-equivalence
curl localhost:3000/api/training/diloco     # DiLoCo outer loop
curl localhost:3000/api/training/comms      # 50× compression ratio
curl localhost:3000/api/p2p/mesh            # WebRTC signaling topology
curl localhost:3000/api/verify/zk           # SP1 attestation stub
curl localhost:3000/api/models              # Llama/Mistral/DeepSeek registry
curl localhost:3000/api/training/metrics?format=prometheus
```

---

## Worker ecosystem

| Worker | Language | Path | Use case |
|--------|----------|------|----------|
| Browser mesh | JS/WGSL | `public/fractal-worker.js` | Zero-install GPU/CPU tiles + LoRA |
| Native daemon | Node.js | `daemon/mycelia-daemon.mjs` | Multicore CPU harvest |
| Training cell | Node.js | `daemon/training-cell.mjs` | Multi-stage pipeline supervisor |
| P2P relay | Node.js | `daemon/p2p-relay.mjs` | TURN fallback dev stub |
| Reference worker | Python | `examples/train_worker.py` | numpy pull/contribute loop |
| PyTorch worker | Python | `examples/train_worker_pytorch.py` | PEFT + bitsandbytes path |
| Pipeline stage | Python | `examples/pipeline_stage_worker.py` | Regime-2 stage simulator |
| Python SDK | Python | `sdk/python/mycelia/client.py` | Production client library |
| Rust cell | Rust | `crates/mycelia-cell/` | High-throughput native worker |

Join the mesh as an external trainer:

```bash
pip install requests numpy
python examples/train_worker.py          # numpy reference
python examples/train_worker_pytorch.py  # torch if installed
./scripts/demo-training-mesh.sh 5        # spin up 5 cells + pipeline stages
```

---

## The database: built real, AWS deferred

Production targets **Amazon Aurora DSQL** — but this build provisions **zero AWS**. The entire data layer runs on **PGlite** (embedded Postgres-in-WASM). Because DSQL is Postgres-compatible, the SQL, transactions, OCC-retry wrapper, and single-connection discipline are the *real* design:

```typescript
// Swap point — one file, not a rewrite
frontend/lib/db/index.ts  →  @aws/aurora-dsql-nodejs connector
```

Schema: [`frontend/lib/db/schema.sql`](frontend/lib/db/schema.sql) · Bootstrap: [`scripts/db-setup.mjs`](frontend/scripts/db-setup.mjs) · AWS guide: [`docs/AWS_ONBOARDING.md`](docs/AWS_ONBOARDING.md)

---

## Run it

```bash
cd frontend
pnpm install
pnpm dev              # http://localhost:3000 — PGlite migrates + seeds on first request
```

1. Open **Network** → click **Join the mesh** (WebGPU fractal + training contribution)
2. Open **Marketplace** → submit a job in plain English
3. Watch tiles render and validation loss drop in real time

Optional:

```bash
export ANTHROPIC_API_KEY=sk-ant-...     # real Claude NL parsing (else keyword fallback)
export MYCELIA_DB_DIR=./data            # persist PGlite across restarts
export MYCELIA_COORDINATOR=http://localhost:3000  # for external workers
```

Full demo script: [`docs/DEMO.md`](docs/DEMO.md)

### Test

```bash
cd frontend
pnpm test                # 92 Vitest unit tests — fractal, training, PP/TP, compress,
                         # economics, referee, zk stub, distributed-training…

pnpm dev                 # terminal 1
pnpm test:smoke          # terminal 2 — live integration: escrow, overdraft,
                         # cheat-rejection, slashing, training convergence,
                         # reconciliation, MCP surface, hardening
pnpm test:fuzz           # property-based fuzz (state machine)
```

CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) on every PR.

### Build & deploy

```bash
cd frontend && pnpm build     # production build (must stay green)
./scripts/deploy-coordinator.sh staging   # Terraform + ECS dry-run
```

---

## Infrastructure (roadmap topology)

| Component | Config | Status |
|-----------|--------|--------|
| Aurora DSQL cluster | `infra/terraform/dsql/` | Roadmap — swap in `lib/db/index.ts` |
| Multi-region coordinator | `infra/terraform/multi-region/` | Roadmap |
| TURN relay (coturn) | `infra/terraform/turn/` + `infra/k8s/turn-daemonset.yaml` | Roadmap |
| Coordinator ECS | `infra/k8s/coordinator-deployment.yaml` | Roadmap |
| Prometheus alerts | `infra/monitoring/prometheus-rules.yaml` | Roadmap |
| Cloud console UI | `frontend/app/cloud/` | Live (PGlite status + architecture diagram) |

---

## Documentation

| Doc | Contents |
|-----|----------|
| [`PLAN.md`](PLAN.md) | Master plan — vision, phases 0–6, economics |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Data model, job lifecycle, ledger invariants, API |
| [`docs/ML_LAYER.md`](docs/ML_LAYER.md) | **Distributed training bible** — cells, DiLoCo, Regime 1/2 |
| [`docs/TRAINING_STACK.md`](docs/TRAINING_STACK.md) | Module map + live vs roadmap matrix |
| [`docs/TRANSPORT_LAYER.md`](docs/TRANSPORT_LAYER.md) | WebRTC activation transport, wire budgets |
| [`docs/ZK_VERIFICATION.md`](docs/ZK_VERIFICATION.md) | SP1 attestation pipeline |
| [`docs/MULTI_REGION.md`](docs/MULTI_REGION.md) | Regional topology + failover |
| [`docs/DEMO.md`](docs/DEMO.md) | Click-by-click hackathon demo |
| [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md) | Acceptance criteria |
| [`docs/AWS_ONBOARDING.md`](docs/AWS_ONBOARDING.md) | DSQL + async backend integration |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records (DiLoCo, WebRTC, SP1) |
| [`CLAUDE.md`](CLAUDE.md) | AI agent contributor guide |

---

## Roadmap

| Phase | Milestone | Status |
|-------|-----------|--------|
| 0 | Repo hygiene, CI, PGlite | ✅ |
| 1 | Coordinator + escrow ledger | ✅ Live |
| 2 | Distributed fractal + browser worker | ✅ Live |
| 3 | NL submit + MCP + auth | ✅ Live |
| 4 | LoRA training Regime 1 + canary-loss | ✅ Live |
| 5 | Verification moat (stake/referee/slash) | ✅ Live |
| 5b | PP/TP proofs + compression + SDK | ✅ Live |
| 6 | WebRTC P2P activations + Regime 2 wire | 🔨 Signaling modeled, wire pending |
| 7 | SP1 zk attestation | 🔨 Guest + stub prove/verify |
| 8 | Aurora DSQL + multi-region failover | 🔨 PGlite swap point ready |
| 9 | Full pretrain + federated + 3D/ETL workloads | 📋 Registry + stubs |

Tracked as GitHub issues per phase. The gap between demo and production is **infrastructure, not architecture** — the math is proven, the protocols are defined, the swap points are documented.

---

## Vision

We are not building another GPU rental marketplace. We are building the **immune system for planetary-scale ML** — where every laptop is a neuron, every adapter sync is a synapse, and every verified contribution is rewarded by a ledger that **cannot pay cheaters**.

The forest floor is already there. **Mycelia is what grows on it.**

<div align="center">

*Many small nodes · One living organism · Train anywhere*

**[⭐ Star this repo](https://github.com/GodlyDonuts/Mycelia)** if you believe AI training belongs to everyone, not just hyperscalers.

</div>
