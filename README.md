<div align="center">

# Mycelia

### *The planetary nervous system for distributed intelligence.*

**Weave idle consumer GPUs into a living compute organism — and train the next generation of AI on it.**

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-6fd3b8?style=flat-square)](#test)
[![Stack](https://img.shields.io/badge/Stack-Next.js%2016%20·%20React%2019%20·%20PGlite-d8a25a?style=flat-square)](#run-it)
[![Training](https://img.shields.io/badge/Training-DiLoCo%20·%20LoRA%20·%20PP%2FTP-6fd3b8?style=flat-square)](docs/ML_LAYER.md)
[![Verify](https://img.shields.io/badge/Verify-Canary%20·%20Refereed%20·%20ZK-d8a25a?style=flat-square)](docs/ZK_VERIFICATION.md)
[![P2P](https://img.shields.io/badge/P2P-WebRTC%20·%20TURN%20·%20BWE-6fd3b8?style=flat-square)](docs/TRANSPORT_LAYER.md)
[![Regions](https://img.shields.io/badge/Regions-us%20·%20eu%20·%20apac-d8a25a?style=flat-square)](docs/MULTI_REGION.md)

*54 API routes · 17 training modules · 11 workload classes · 2 Rust crates · 4 regions · gRPC · Terraform · K8s · 92 tests*

[Run it](#run-it) · [Architecture](#architecture) · [System diagrams](#system-diagrams) · [Training stack](#the-distributed-training-stack) · [Verification moat](#verification-at-planetary-scale) · [Docs](#documentation)

</div>

---

## Table of contents

| | Diagram / section |
|---|---|
| 🌐 | [Planetary system architecture](#diagram-1--planetary-system-architecture) — full stack, all layers |
| 🔄 | [End-to-end request & data plane](#diagram-2--end-to-end-request--data-plane) |
| 🧬 | [Training round sequence](#diagram-3--training-round-sequence-regime-1) |
| 🔀 | [Regime 1 vs Regime 2 cell topology](#diagram-4--regime-1-vs-regime-2-cell-topology) |
| ⚡ | [Pipeline-parallel micro-batch flow](#diagram-5--pipeline-parallel-micro-batch-flow-regime-2) |
| 🛡️ | [Verification escalation pipeline](#diagram-6--verification-escalation-pipeline) |
| 💰 | [Escrow & ledger state machine](#diagram-7--escrow--ledger-state-machine) |
| 🧩 | [Job & tile lifecycle](#diagram-8--job--tile-lifecycle) |
| 🌍 | [Multi-region deployment topology](#diagram-9--multi-region-deployment-topology) |
| 📦 | [Module dependency graph](#diagram-10--module-dependency-graph) |
| 🗄️ | [Data model entity relationships](#diagram-11--data-model-entity-relationships) |

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

Mycelia is not a monolith with a README diagram — it is a **layered planetary system** with distinct control plane, data plane, ML engine, P2P fabric, verification stack, and multi-region supply mesh. The diagrams below are the canonical reference.

## System diagrams

### Diagram 1 — Planetary system architecture

The full stack: every client surface, every coordinator subsystem, every ML module, every worker runtime, every infra primitive, connected.

```mermaid
flowchart TB
    subgraph CLIENTS["🖥️ CLIENT SURFACES"]
        direction LR
        WEB["Next.js App Router<br/>9 screens + Cloud console"]
        MCP["MCP Agent Tools<br/>7 read-only tools"]
        SDK_PY["Python SDK<br/>mycelia.client"]
        SDK_RUST["Rust Cell<br/>mycelia-cell crate"]
        EXT["External Workers<br/>numpy · PyTorch · pipeline"]
    end

    subgraph API_GATE["⚡ API GATEWAY — 54 route handlers"]
        direction TB
        COORD_API["Coordinator API<br/>submit · pull-work · settle"]
        TRAIN_API["Training API ×15<br/>pull · diloco · pipeline · tensor"]
        P2P_API["P2P API<br/>mesh · bwe · signaling"]
        VERIFY_API["Verify API<br/>referee · replication · zk"]
        PLATFORM["Platform API<br/>auth · wallet · mcp · health"]
    end

    subgraph CONTROL["🧠 CONTROL PLANE"]
        direction TB
        COORD["lib/coordinator.ts<br/>Job fan-out · tile claim · 40001 retry"]
        TRAIN_COORD["lib/training/coordinator.ts<br/>Round orchestration · canary-loss"]
        READS["lib/reads.ts<br/>Polling read path"]
        DRIVER["lib/driver.ts<br/>In-process mesh simulator"]
        AUTH["lib/auth.ts<br/>HMAC sessions · RBAC"]
        REGIONS["lib/regions.ts<br/>Multi-region routing"]
    end

    subgraph ML["🔬 ML ENGINE — lib/training/ ×17"]
        direction TB
        subgraph OUTER["Outer loop — WAN-friendly"]
            DILOCO["diloco.ts<br/>Nesterov outer opt · H=100"]
            COMPRESS["compress.ts<br/>top-k + int8 + error feedback"]
            HETERO["heterogeneity.ts<br/>Capability-weighted shards"]
            GOSSIP["gossip.ts<br/>Partition fallback"]
        end
        subgraph INNER["Inner loop — cell-local"]
            MODEL["model.ts<br/>LoRA + localTrain"]
            PIPELINE["pipeline.ts<br/>PP grad proof"]
            TENSOR["tensor.ts<br/>TP grad proof"]
            RING["ring-allreduce.ts<br/>Intra-cell sync"]
            TRANSPORT["transport.ts<br/>Activation envelopes"]
        end
        subgraph SUPPORT["Training support"]
            CKPT["checkpointing.ts"]
            DATALOAD["dataloader.ts"]
            MIXED["mixed-precision.ts"]
            OFFLOAD["activation-offload.ts"]
            REF_TRAIN["refereed.ts"]
        end
    end

    subgraph P2P["📡 P2P FABRIC — lib/p2p/"]
        WEBRTC["webrtc-mesh.ts<br/>SDP · ICE sessions"]
        ICE["ice-config.ts<br/>STUN/TURN per region"]
        BWE["bandwidth-estimator.ts<br/>Adaptive int8/fp16"]
        RELAY["daemon/p2p-relay.mjs<br/>TURN fallback"]
    end

    subgraph VERIFY["🛡️ VERIFICATION MOAT"]
        direction TB
        CANARY["Canary-loss<br/>Training Δ rejection"]
        REFEREE["lib/referee.ts<br/>O log n recompute"]
        REP["lib/replication.ts<br/>Redundant agreement"]
        STAKE["lib/verification.ts<br/>Stake · rep · slash"]
        ZK["lib/zk/sp1-training.ts<br/>SP1 attestation"]
        CIRCUITS["lib/zk/circuits.ts<br/>Groth16 research"]
        SP1_GUEST["crates/mycelia-sp1-guest<br/>RISC-V guest ELF"]
    end

    subgraph DATA["🗄️ DATA PLANE"]
        DB["lib/db/index.ts<br/>PGlite → Aurora DSQL swap"]
        SCHEMA["schema.sql<br/>jobs · tiles · ledger · training"]
        S3["S3 checkpoints · datasets<br/>content-addressed blobs"]
    end

    subgraph SUPPLY["⚙️ COMPUTE SUPPLY MESH"]
        direction LR
        BROWSER["Browser Worker<br/>WebGPU WGSL + CPU fallback"]
        DAEMON["mycelia-daemon.mjs<br/>Multicore harvest"]
        CELL_SUP["training-cell.mjs<br/>Pipeline supervisor"]
        FRACTAL["lib/fractal.ts<br/>Deterministic kernel"]
    end

    subgraph INFRA["☁️ INFRASTRUCTURE"]
        TF_DSQL["terraform/dsql"]
        TF_MULTI["terraform/multi-region"]
        TF_TURN["terraform/turn"]
        K8S["k8s coordinator + coturn"]
        PROM["prometheus-rules.yaml"]
    end

    subgraph REGIONS["🌍 REGIONS"]
        USE1["us-east-1<br/>Primary coordinator"]
        USW2["us-west-2<br/>Replica + cells"]
        EUW1["eu-west-1<br/>GDPR partition"]
        APSE1["ap-southeast-1<br/>APAC cells"]
    end

    CLIENTS --> API_GATE
    API_GATE --> CONTROL
    CONTROL --> ML
    CONTROL --> VERIFY
    CONTROL --> DATA
    ML --> P2P
    ML --> DATA
    VERIFY --> ZK
    ZK --> SP1_GUEST
    P2P --> RELAY
    SUPPLY --> API_GATE
    EXT --> API_GATE
    SDK_PY --> API_GATE
    SDK_RUST --> API_GATE
    DATA --> S3
    CONTROL --> REGIONS
    INFRA --> REGIONS
    USE1 --- USW2
    USE1 --- EUW1
    USE1 --- APSE1
    BROWSER --> SUPPLY
    DAEMON --> SUPPLY
    FRACTAL --> BROWSER
    FRACTAL --> DAEMON
```

---

### Diagram 2 — End-to-end request & data plane

Every write path flows through validation → coordinator → single DB connection. Reads poll through `reads.ts`. Background simulation keeps the mesh alive.

```mermaid
flowchart LR
    subgraph INGRESS["Ingress"]
        POLL["usePoll / useNetwork<br/>client polling"]
        POST["POST handlers<br/>Zod + rate limit"]
    end

    subgraph HANDLERS["app/api/*"]
        R_SUBMIT["/submit"]
        R_PULL["/pull-work"]
        R_RESULT["/submit-result"]
        R_TRAIN["/training/pull"]
        R_CONTRIB["/training/submit-contribution"]
        R_SETTLE["/settle"]
    end

    subgraph CORE["lib/ core"]
        COORD_W["coordinator.ts<br/>writes + OCC retry"]
        READS_R["reads.ts<br/>aggregates"]
        WITH_TX["withTx()<br/>single connection discipline"]
    end

    subgraph DB_LAYER["lib/db/"]
        INDEX["index.ts<br/>getDb · query · queryOne"]
        PGLITE["PGlite WASM<br/>in-memory or MYCELIA_DB_DIR"]
        DSQL_FUTURE["Aurora DSQL<br/>swap target"]
    end

    subgraph BG["Background"]
        DRIVER_B["driver.ts<br/>simulated nodes"]
        TRAIN_DRV["training/driver.ts<br/>simulated cells"]
    end

    subgraph TABLES["Postgres tables"]
        JOBS["jobs"]
        TILES["tiles"]
        LEDGER["ledger_entries"]
        BAL["account_balance"]
        NODES["nodes"]
        TRAINING["training_rounds"]
    end

    POLL --> READS_R
    POST --> HANDLERS
    HANDLERS --> COORD_W
    COORD_W --> WITH_TX
    WITH_TX --> INDEX
    INDEX --> PGLITE
    PGLITE -.-> DSQL_FUTURE
    INDEX --> TABLES
    DRIVER_B --> COORD_W
    TRAIN_DRV --> COORD_W
    READS_R --> INDEX

    style DSQL_FUTURE stroke-dasharray: 5 5
```

---

### Diagram 3 — Training round sequence (Regime 1)

One full DiLoCo round: fan-out → H local steps → compress → verify → outer merge → pay.

```mermaid
sequenceDiagram
    autonumber
    participant R as Requester / UI
    participant C as Training Coordinator
    participant L as Ledger / Escrow
    participant DB as PGlite / DSQL
    participant A as Cell A · RTX 4090
    participant B as Cell B · RTX 3060
    participant N as Cell C · Laptop
    participant V as Verification Engine

    R->>C: POST /training/start (model, dataset, H=100)
    C->>L: Lock escrow for training budget
    L->>DB: Atomic debit · serialization row

    loop Round r
        C->>DB: Load θ_global adapter
        par Fan-out to all cells
            C->>A: θ_global + shard D₁ + H steps
            C->>B: θ_global + shard D₂ + H steps
            C->>N: θ_global + shard D₃ + H steps
        end

        par H local AdamW steps
            A->>A: localTrain(θ, D₁, H) → θ_A
            B->>B: localTrain(θ, D₂, H) → θ_B
            N->>N: localTrain(θ, D₃, H) → θ_N
        end

        par Compute pseudo-gradients
            A->>A: Δ_A = θ_global − θ_A
            B->>B: Δ_B = θ_global − θ_B
            N->>N: Δ_N = θ_global − θ_N
        end

        par Compress + submit
            A->>C: top-k int8 packed Δ_A + loss
            B->>C: top-k int8 packed Δ_B + loss
            N->>C: top-k int8 packed Δ_N + loss
        end

        C->>V: Canary-loss check each Δ
        V-->>C: Accept / reject per cell

        C->>C: DiLoCo outer step<br/>capability-weighted mean(Δ)
        C->>DB: θ_global ← OuterOpt(θ, Δ̄)
        C->>DB: Log validation loss

        C->>L: Pay accepted cells · MYC credits
        L->>DB: Append ledger_entries

        C->>R: SSE / poll · loss curve update
    end

    R->>C: Target loss reached / budget exhausted
    C->>L: Release remaining escrow
```

---

### Diagram 4 — Regime 1 vs Regime 2 cell topology

The **cell** abstraction unifies both regimes. Outer DiLoCo loop is identical; inner connectivity differs radically.

```mermaid
flowchart TB
    subgraph GLOBAL["GLOBAL COORDINATOR — DiLoCo outer loop"]
        THETA["θ_global adapter<br/>few MB · sync every H steps"]
        OUTER["OuterOpt Nesterov<br/>capability-weighted Δ merge"]
    end

    subgraph R1["REGIME 1 — Data parallel · LIVE"]
        direction TB
        R1A["Cell A = Node A<br/>1× RTX 4090 · shard 1"]
        R1B["Cell B = Node B<br/>1× RTX 3060 · shard 2"]
        R1C["Cell C = Node C<br/>Laptop GPU · shard 3"]
        R1D["Cell D = Node D<br/>Browser WebGPU · shard 4"]
    end

    subgraph R2["REGIME 2 — Model sharded · PROOF + WIRE ROADMAP"]
        direction TB
        subgraph CELL_D["Cell D = 4-stage pipeline · Llama 70B"]
            S1["Stage 1 · layers 0-19<br/>W_qkv shard"]
            S2["Stage 2 · layers 20-39"]
            S3["Stage 3 · layers 40-59"]
            S4["Stage 4 · layers 60-79<br/>W_down shard"]
            S1 -->|"activation h₁<br/>WebRTC DC"| S2
            S2 -->|"activation h₂"| S3
            S3 -->|"activation h₃"| S4
            S4 -->|"grad ∂h₃"| S3
            S3 -->|"grad ∂h₂"| S2
            S2 -->|"grad ∂h₁"| S1
        end
    end

    THETA --> R1A & R1B & R1C & R1D
    THETA --> CELL_D
    R1A & R1B & R1C & R1D -->|"Δ_A Δ_B Δ_C Δ_D<br/>top-k int8 over WAN"| OUTER
    CELL_D -->|"Δ_cell<br/>single pseudo-grad"| OUTER
    OUTER --> THETA

    style R1 fill:#0d2a24,stroke:#6fd3b8
    style R2 fill:#2a1f0d,stroke:#d8a25a
```

---

### Diagram 5 — Pipeline-parallel micro-batch flow (Regime 2)

GPipe-style forward/backward across stages. Activations never touch the coordinator — only signaling does.

```mermaid
flowchart LR
    subgraph COORD["Coordinator — signaling only"]
        SIG["WebSocket /api/p2p/signaling<br/>SDP + ICE candidates"]
    end

    subgraph STAGE1["Stage 1 · Node n₁"]
        W1["W1 · q/k/v proj LoRA"]
        F1["forward(z) → h"]
    end

    subgraph STAGE2["Stage 2 · Node n₂"]
        W2["W2 · MLP gate/up"]
        F2["forward(h) → h'"]
    end

    subgraph STAGE3["Stage 3 · Node n₃"]
        W3["W3 · MLP down + o proj"]
        F3["forward(h') → y · loss"]
        B3["backward → ∂h'"]
    end

    subgraph WIRE["P2P DataChannels"]
        DC1["activation-v1<br/>fp16 or int8 adaptive"]
        DC2["gradient-v1<br/>backward signal"]
    end

    subgraph BWE_L["bandwidth-estimator.ts"]
        ADAPT["BWE < 20 Mbps → int8<br/>BWE > 200 Mbps → fp32"]
    end

    SIG -.-> STAGE1 & STAGE2 & STAGE3
    F1 --> DC1 --> F2 --> DC1 --> F3
    B3 --> DC2 --> STAGE2
    BWE_L --> DC1
    ADAPT --> DC1

    subgraph PROOF["In-process proof · LIVE"]
        MONO["monolithic()"]
        PIPE["pipeline()"]
        DIFF["gradDiff < 1e-9 ✓"]
        MONO --> DIFF
        PIPE --> DIFF
    end
```

---

### Diagram 6 — Verification escalation pipeline

Every workload class declares its verification primitive. Training escalates through four tiers.

```mermaid
flowchart TD
    SUBMIT["Worker submits result<br/>tile hash · adapter Δ · render frame"]

    subgraph L0["L0 · Economic deterrence · LIVE"]
        STAKE["Stake at risk"]
        REP["Reputation score"]
        SLASH["Slashing on failed challenge"]
        SPOT["Dynamic spot-check rate ∝ 1/rep"]
    end

    subgraph L1["L1 · Deterministic check · LIVE"]
        SELF["Self-check · reseed recompute"]
        CANARY["Canary-loss · training Δ"]
        LOSS["Loss must decrease within ε"]
    end

    subgraph L2["L2 · Refereed delegation · LIVE"]
        BINARY["Binary search compute graph"]
        DIVERGE["First divergent op"]
        RECOMP["Recompute O log n rows"]
        SPEEDUP["64× vs full recompute"]
    end

    subgraph L3["L3 · Cryptographic · ROADMAP"]
        WITNESS["Training witness builder"]
        SP1P["SP1 prover · CUDA/CPU"]
        PROVE["RISC-V guest · training_attest.elf"]
        VERIFY_ZK["Verify in 12ms"]
    end

    ACCEPT["✓ Accept → pay MYC credits"]
    REJECT["✗ Reject → slash · no pay"]

    SUBMIT --> L0
    L0 --> L1
    L1 -->|pass| L2
    L1 -->|fail| REJECT
    L2 -->|pass| ACCEPT
    L2 -->|fail| REJECT
    L2 -->|enterprise tier| L3
    L3 --> VERIFY_ZK
    VERIFY_ZK -->|valid proof| ACCEPT
    VERIFY_ZK -->|invalid| REJECT
    SLASH --> REJECT

    subgraph WORKLOADS["Per-workload verify primitive"]
        W1["fractal → self-check + referee"]
        W2["montecarlo → reseed bitwise"]
        W3["lora → canary-loss + referee"]
        W4["inference → reseed recompute"]
        W5["pipeline-70b → activation checksum"]
        W6["zk-attest → SP1 proof required"]
    end
```

---

### Diagram 7 — Escrow & ledger state machine

The ledger invariant: **no overdraft, escrow always covers pending payouts, settlement is idempotent.**

```mermaid
stateDiagram-v2
    [*] --> Available: Account funded

    Available --> EscrowLocked: submit job<br/>atomic debit + serialization row
    EscrowLocked --> Pending: Tiles / rounds dispatched

    Pending --> Verifying: Worker submits result
    Verifying --> Verified: Check passes
    Verifying --> Rejected: Check fails · slash

    Verified --> Paid: settle idempotent<br/>credit contributor
    Paid --> Available: Escrow reduced

    Rejected --> Pending: Reassign tile / shard
    Rejected --> Failed: Max retries exceeded

    Pending --> Refunded: Job cancelled / timeout
    Refunded --> Available: Escrow returned

    Failed --> Refunded: Partial refund policy

    note right of EscrowLocked
        account_balance row
        prevents concurrent overdraft
        40001 OCC retry on conflict
    end note

    note right of Paid
        append-only ledger_entries
        reconciliation sweep proves
        sum debits = sum credits + escrow
    end note
```

---

### Diagram 8 — Job & tile lifecycle

From NL submission to reassembled image or completed training round.

```mermaid
stateDiagram-v2
    [*] --> Parsed: NL / JobSpec Zod validate

    Parsed --> Submitted: escrow debit OK
    Submitted --> Scheduled: tiles / rounds written pending

    state Scheduled {
        [*] --> Pending
        Pending --> Claimed: pull-work 40001 UPDATE
        Claimed --> Running: worker executes kernel
        Running --> SubmittedResult: POST hash + blob
        SubmittedResult --> Verified: verification pass
        SubmittedResult --> Failed: verification fail
        Failed --> Pending: reassign
        Verified --> [*]
    }

    Scheduled --> Reassembling: all tiles verified
    Reassembling --> Complete: image assembled / round merged
    Complete --> Settled: idempotent settle
    Settled --> [*]

    Scheduled --> Cancelled: requester cancel
    Cancelled --> [*]
```

---

### Diagram 9 — Multi-region deployment topology

Production topology: regional coordinators, TURN pools, DSQL replicas, checkpoint buckets.

```mermaid
flowchart TB
    subgraph DNS["Route 53 · Global"]
        R53["coordinator.mycelia.dev<br/>health-checked failover"]
    end

    subgraph USE1["🇺🇸 us-east-1 · PRIMARY"]
        COORD1["Coordinator ECS ×3<br/>Next.js + PGlite leader"]
        DSQL1["Aurora DSQL leader"]
        TURN1["coturn Fargate ×3"]
        S3_1["S3 checkpoints-us-east"]
        CELLS1["Cells · 4090 fleet"]
    end

    subgraph USW2["🇺🇸 us-west-2"]
        COORD2["Coordinator replica"]
        DSQL2["DSQL async replica"]
        TURN2["coturn ×2"]
        S3_2["S3 checkpoints-us-west"]
        CELLS2["Cells · mixed GPUs"]
    end

    subgraph EUW1["🇪🇺 eu-west-1 · GDPR"]
        COORD3["Coordinator replica"]
        DSQL3["DSQL async replica"]
        TURN3["coturn ×2"]
        S3_EU["S3 datasets-eu · residency"]
        CELLS3["EU-only data shards"]
    end

    subgraph APSE1["🇸🇬 ap-southeast-1"]
        TURN4["coturn ×2"]
        CELLS4["APAC cells"]
    end

    subgraph FAILOVER["Partition handling"]
        SWIM["SWIM gossip · membership.ts"]
        GOSSIP2["gossip.ts delta fallback"]
        PART["partition.ts split-brain detect"]
    end

    R53 --> COORD1
    R53 -.-> COORD2
    R53 -.-> COORD3
    COORD1 --> DSQL1
    DSQL1 -.-> DSQL2 & DSQL3
    COORD1 --> TURN1
    COORD2 --> TURN2
    COORD3 --> TURN3
    CELLS1 & CELLS2 & CELLS3 & CELLS4 --> COORD1
    CELLS1 -.->|"WebRTC DC<br/>same-metro PP only"| CELLS1
    SWIM --> PART
    PART --> GOSSIP2

    style USE1 fill:#0d2a24,stroke:#6fd3b8
    style EUW1 fill:#1a1a2e,stroke:#6fd3b8
```

---

### Diagram 10 — Module dependency graph

How `lib/` modules compose. Single DB swap point; fractal kernel isomorphic server/browser.

```mermaid
flowchart BT
    subgraph UI["components/ + app/"]
        NET_UI["network/ training-panel"]
        TRUST_UI["verification/"]
        CLOUD_UI["cloud/ console"]
    end

    subgraph API["app/api/"]
        API_ALL["54 route handlers"]
    end

    subgraph WRITE["Write path"]
        COORD["coordinator.ts"]
        TC["training/coordinator.ts"]
    end

    subgraph READ["Read path"]
        READS["reads.ts"]
        HEALTH["health.ts reconciliation"]
    end

    subgraph KERNEL["Deterministic kernels"]
        FRACTAL["fractal.ts"]
        TRAIN_MODEL["training/model.ts"]
        PIPELINE["training/pipeline.ts"]
        TENSOR["training/tensor.ts"]
        INFER["inference.ts"]
        MC["montecarlo.ts"]
    end

    subgraph TRUST["Trust layer"]
        VER["verification.ts"]
        REF["referee.ts"]
        REP["replication.ts"]
        SANDBOX["sandbox.ts"]
        ZK["zk/sp1-training.ts"]
    end

    subgraph COMM["Communication"]
        COMP["training/compress.ts"]
        DILOCO["training/diloco.ts"]
        P2P["p2p/webrtc-mesh.ts"]
        TRANS["training/transport.ts"]
    end

    subgraph PERSIST["Persistence"]
        DB["db/index.ts"]
        SEED["db/seed.ts"]
    end

    UI --> API
    API --> WRITE & READ
    WRITE --> COORD & TC
    COORD --> FRACTAL & DB
    TC --> TRAIN_MODEL & COMP & DILOCO & VER
    TC --> PIPELINE & TENSOR
    READ --> DB
    HEALTH --> DB
    VER --> REF & REP
    VER --> ZK
    PIPELINE --> TRANS --> P2P
    TENSOR --> COMP
    FRACTAL --> SANDBOX

    style DB fill:#0d2a24,stroke:#6fd3b8,stroke-width:3px
```

---

### Diagram 11 — Data model entity relationships

Core Postgres schema — jobs fan out to tiles; training rounds fan out to contributions; ledger is append-only.

```mermaid
erDiagram
    ACCOUNTS ||--o{ LEDGER_ENTRIES : posts
    ACCOUNTS ||--|| ACCOUNT_BALANCE : serializes
    ACCOUNTS ||--o{ JOBS : submits
    JOBS ||--|{ TILES : fans_out
    TILES }o--|| NODES : claimed_by
    NODES ||--o{ HEARTBEATS : emits
    NODES }o--o{ CELL_MEMBERS : belongs_to

    TRAINING_JOBS ||--|{ TRAINING_ROUNDS : contains
    TRAINING_ROUNDS ||--o{ CONTRIBUTIONS : collects
    CONTRIBUTIONS }o--|| NODES : submitted_by
    TRAINING_JOBS ||--|| ADAPTERS : tracks_theta

    JOBS {
        uuid id PK
        text status
        numeric escrow_amount
        jsonb jobspec
        timestamptz deadline
    }

    TILES {
        uuid id PK
        uuid job_id FK
        int tile_x tile_y
        text status
        uuid node_id FK
        text result_hash
    }

    LEDGER_ENTRIES {
        bigserial id PK
        uuid account_id FK
        text kind
        numeric amount
        uuid ref_id
        timestamptz at
    }

    ACCOUNT_BALANCE {
        uuid account_id PK
        numeric available
        numeric escrow
        int version
    }

    NODES {
        uuid id PK
        text name
        text gpu_model
        text region
        float reputation
        numeric stake
    }

    TRAINING_ROUNDS {
        uuid id PK
        int round_num
        bytea adapter_snapshot
        float val_loss
        text status
    }

    CONTRIBUTIONS {
        uuid id PK
        uuid round_id FK
        uuid node_id FK
        bytea delta_compressed
        float loss_before loss_after
        bool accepted
    }

    CELL_MEMBERS {
        uuid node_id FK
        text cell_id
        int stage_index
        text health
    }
```

---

Full reference: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Training deep-dive: [`docs/ML_LAYER.md`](docs/ML_LAYER.md) · Stack map: [`docs/TRAINING_STACK.md`](docs/TRAINING_STACK.md) · Transport: [`docs/TRANSPORT_LAYER.md`](docs/TRANSPORT_LAYER.md)

---

## The distributed training stack

Mycelia's ML layer is not a slide deck. It is **17 modules, 15 training API routes, 2 protobuf services, 2 JSON schemas, 2 YAML job configs, a Python SDK, and two Rust crates** — all cross-referenced to a single design doc.

### Two levels of splitting

The entire design rests on one insight: **split data often, split models only when forced.**

```mermaid
flowchart TB
    JOB["TRAINING JOB<br/>Fine-tune LoRA θ on dataset D<br/>base frozen · 4-bit QLoRA"]

    subgraph OUTER["OUTER LOOP — sync every H=100 steps · WAN-friendly"]
        FAN["Coordinator fan-out<br/>θ_global + shard ref to each cell"]
        LOCAL["H local AdamW steps per cell"]
        DELTA["Pseudo-grad Δ = θ_global − θ_local"]
        PACK["top-k + int8 + error feedback<br/>~50× compression vs dense fp32"]
        MERGE["DiLoCo OuterOpt<br/>capability-weighted Nesterov"]
        VAL["Validation loss ↓ · pay accepted cells"]
    end

    subgraph CELLS["CELLS — data parallel across the mesh"]
        CA["Cell A · RTX 4090<br/>shard 1 · 1200 tok/s"]
        CB["Cell B · RTX 3060<br/>shard 2 · 800 tok/s"]
        CC["Cell C · Laptop<br/>shard 3 · 400 tok/s"]
        CD["Cell D · 4-stage pipeline<br/>Llama 70B · ROADMAP"]
    end

    JOB --> FAN
    FAN --> CA & CB & CC & CD
    CA & CB & CC & CD --> LOCAL
    LOCAL --> DELTA --> PACK --> MERGE --> VAL
    VAL -->|"round r+1"| FAN

    style OUTER fill:#0d2a24,stroke:#6fd3b8
    style CD fill:#2a1f0d,stroke:#d8a25a
```

### Communication compression pipeline

```mermaid
flowchart LR
    subgraph CELL["Each cell after H steps"]
        VEC["Dense Δ<br/>dim × 4 bytes"]
        RES["Error residual<br/>from prior round"]
    end

    subgraph COMPRESS["compress.ts"]
        ADD["vec + residual"]
        TOPK["Top-k sparsify<br/>k = ceil dim × 0.02"]
        INT8["int8 quantize<br/>scale = max/127"]
        PACK["Packed payload<br/>k×2 idx + k int8 + scale"]
        NEWRES["New residual<br/>what compression dropped"]
    end

    subgraph WAN["Home internet uplink"]
        SHIP["Ship packed Δ<br/>LoRA r16 0.5B → ~22 KB"]
    end

    subgraph COORD["Coordinator"]
        DEQ["decompress()"]
        FEED["Feed residual next round"]
        OUTER["DiLoCo merge"]
    end

    VEC --> ADD
    RES --> ADD
    ADD --> TOPK --> INT8 --> PACK
    TOPK --> NEWRES
    PACK --> SHIP --> DEQ --> OUTER
    NEWRES --> FEED --> RES
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

```mermaid
flowchart BT
    subgraph L3["L3 · SP1 zkVM · ROADMAP"]
        ZK3["Succinct proof:<br/>SGD_H θ, shard, seed → θ'"]
        CRYPTO["12ms verify · cryptographic guarantee"]
    end

    subgraph L2["L2 · Refereed delegation · LIVE"]
        REF2["Binary search compute graph"]
        OLOGN["O log n recompute · 64× speedup"]
    end

    subgraph L1["L1 · Deterministic · LIVE"]
        DET1["Reseed recompute · bitwise match"]
        CAN1["Canary-loss · training Δ bound"]
    end

    subgraph L0["L0 · Economics · LIVE"]
        ECO0["Stake · reputation · slashing"]
        SPOT0["Spot-check rate ∝ 1/reputation"]
    end

    PAY["Pay MYC credits"]
    SLASH["Slash stake · reject"]

    L0 --> L1 --> L2 --> L3
    L1 -->|fail| SLASH
    L2 -->|fail| SLASH
    L3 -->|invalid proof| SLASH
    L2 -->|pass| PAY
    L3 -->|valid proof| PAY
    L0 --> ECO0
```

### Workload verification matrix

```mermaid
mindmap
  root((Mycelia<br/>Workloads))
    Live
      fractal
        self-check
        referee O log n
      montecarlo
        reseed bitwise
      lora
        canary-loss
        token-weighted pay
      inference
        reseed recompute
    Roadmap
      pipeline-70b
        activation checksum
        stage referee
      tensor-parallel
        ring-allreduce commit
        grad-norm bound
      render3d
        proof-of-render hash
      etl
        redundant agreement
      zk-attest
        SP1 proof required
      pretrain
        checkpoint Merkle
      federated
        DiLoCo + DP audit
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

```mermaid
flowchart TB
    subgraph JOIN["Join the mesh"]
        REG["POST /api/nodes/register<br/>name · gpuModel · region"]
    end

    subgraph WORKERS["Worker runtimes"]
        direction TB
        B["Browser<br/>fractal-worker.js<br/>WebGPU + CPU"]
        D["Daemon<br/>mycelia-daemon.mjs<br/>worker_threads"]
        TC["Training cell<br/>training-cell.mjs<br/>supervises stages"]
        PY["Python numpy<br/>train_worker.py"]
        PT["PyTorch<br/>train_worker_pytorch.py"]
        PS["Pipeline stage<br/>pipeline_stage_worker.py"]
        RS["Rust cell<br/>crates/mycelia-cell"]
    end

    subgraph LOOP["Contribution loop"]
        PULL["POST /training/pull<br/>round + adapter + shard"]
        EXEC["localTrain / render / MC<br/>H steps or tile compute"]
        SUB["POST /training/submit-contribution<br/>Δ + loss_before + loss_after"]
        VER["Canary-loss verify"]
        PAY["MYC credit payout"]
    end

    REG --> WORKERS
    B & D & PY & PT & RS --> PULL
    TC --> PS
    PS --> PULL
    PULL --> EXEC --> SUB --> VER
    VER -->|accepted| PAY
    VER -->|rejected| PULL

    style PAY fill:#0d2a24,stroke:#6fd3b8
```

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

```mermaid
flowchart TB
    subgraph TF["Terraform modules"]
        MOD_DSQL["dsql/<br/>Aurora cluster"]
        MOD_MULTI["multi-region/<br/>Route53 + replicas"]
        MOD_TURN["turn/<br/>coturn Fargate NLB"]
    end

    subgraph K8S["Kubernetes"]
        DEPLOY["coordinator-deployment.yaml<br/>3 replicas · 4 CPU · 8Gi"]
        DS["turn-daemonset.yaml<br/>hostNetwork UDP 3478"]
    end

    subgraph OBS["Observability"]
        PROM["prometheus-rules.yaml"]
        METRICS["/api/training/metrics?format=prometheus"]
        HEALTH["lib/health.ts reconciliation"]
    end

    subgraph LIVE["Live today"]
        PGLITE["PGlite in-process"]
        CLOUD_UI["/cloud architecture diagram"]
    end

    MOD_DSQL --> PGLITE
    MOD_MULTI --> DEPLOY
    MOD_TURN --> DS
    PROM --> METRICS
    HEALTH --> PROM
    DEPLOY --> CLOUD_UI

    style LIVE fill:#0d2a24,stroke:#6fd3b8
```

| Component | Config | Status |
|-----------|--------|--------|
| Aurora DSQL cluster | `infra/terraform/dsql/` | Roadmap — swap in `lib/db/index.ts` |
| Multi-region coordinator | `infra/terraform/multi-region/` | Roadmap |
| TURN relay (coturn) | `infra/terraform/turn/` + `infra/k8s/turn-daemonset.yaml` | Roadmap |
| Coordinator ECS | `infra/k8s/coordinator-deployment.yaml` | Roadmap |
| Prometheus alerts | `infra/monitoring/prometheus-rules.yaml` | Roadmap |
| Cloud console UI | `frontend/app/cloud/` | Live (PGlite status + architecture diagram) |

---

## Technology stack

```mermaid
block-beta
    columns 4

    block:frontend:4
        columns 4
        NEXT["Next.js 16"]:1
        REACT["React 19"]:1
        TW["Tailwind 4"]:1
        SHADCN["shadcn/ui"]:1
    end

    block:runtime:4
        columns 4
        NODE["Node.js"]:1
        PGLITE["PGlite WASM"]:1
        WEBGPU["WebGPU WGSL"]:1
        ZOD["Zod contracts"]:1
    end

    block:ml:4
        columns 4
        LORA["LoRA/QLoRA"]:1
        DILOCO["DiLoCo"]:1
        PP["Pipeline Par"]:1
        TP["Tensor Par"]:1
    end

    block:workers:4
        columns 4
        PY["Python SDK"]:1
        RUST["Rust cell"]:1
        TORCH["PyTorch worker"]:1
        DAEMON["Native daemon"]:1
    end

    block:trust:4
        columns 4
        CANARY["Canary-loss"]:1
        REF["Referee"]:1
        SP1["SP1 zkVM"]:1
        ESCROW["Escrow ledger"]:1
    end

    block:infra:4
        columns 4
        TF["Terraform"]:1
        K8S2["Kubernetes"]:1
        GRPC["gRPC protos"]:1
        PROM2["Prometheus"]:1
    end
```

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

```mermaid
gantt
    title Mycelia build phases
    dateFormat YYYY-MM
    axisFormat %b %Y

    section Foundation
    Repo hygiene CI PGlite           :done, p0, 2025-10, 2025-11
    Coordinator escrow ledger        :done, p1, 2025-11, 2025-12

    section Compute
    Fractal render browser worker    :done, p2, 2025-12, 2026-01
    Native daemon supply engine      :done, p2b, 2026-01, 2026-02

    section Platform
    NL submit MCP auth               :done, p3, 2026-01, 2026-02
    Cloud console multi-region pay     :done, p3b, 2026-02, 2026-03

    section Training
    LoRA Regime 1 canary-loss        :done, p4, 2026-02, 2026-03
    PP TP proofs compression SDK       :done, p5b, 2026-03, 2026-04
    Verification moat stake slash      :done, p5, 2026-03, 2026-04

    section Scale
    WebRTC P2P Regime 2 wire         :active, p6, 2026-04, 2026-08
    SP1 zk attestation               :p7, 2026-06, 2026-10
    Aurora DSQL multi-region         :p8, 2026-07, 2026-11
    Pretrain federated 3D ETL        :p9, 2026-09, 2027-03
```

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
