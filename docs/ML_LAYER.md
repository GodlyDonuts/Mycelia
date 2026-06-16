# Mycelia — Distributed AI/ML Training Layer

> Internal engineering design doc. Companion to [`PLAN.md`](../PLAN.md). This is the design for how Mycelia trains AI models across its fractured, heterogeneous consumer compute.

> **TL;DR** — We train **LoRA/QLoRA adapters** across heterogeneous consumer GPUs using **two-level parallelism**: *data-parallel across "cells" with rare DiLoCo-style synchronization* (which is what makes it feasible over home internet), and *model-parallel within a cell only when a model is too big for a single GPU*. The hackathon demo is the easy regime (a cell = 1 node, pure data-parallel LoRA, with a live validation-loss drop as the hero visual). Model-sharded cells, communication compression, refereed-recompute verification, full pretraining, and distributed inference are the roadmap.

**Decisions baked into this doc** (from team scoping):
- **Lead workload:** LoRA / adapter fine-tuning of an existing open model. Full pretraining and distributed inference are kept as later capabilities, not v1.
- **Scope:** the real architecture **plus** a carved-out hackathon demo slice.
- **Model size:** must eventually support **models bigger than one GPU** — so model sharding is in scope as a roadmap upgrade to the *inner* level, while the demo stays in the single-GPU regime.

---

## 1. The core idea: two levels of splitting

"Split it across our fractured compute" means two fundamentally different things, and the whole design rests on doing them at different frequencies:

- **Split the data (outer loop, always, cheap).** Many independent workers each train the *same* trainable adapter on a *different shard of data* for a batch of local steps, then we merge the results. Communication is just the adapter weights, exchanged **rarely** (every `H` steps). This is the WAN-friendly axis and the one that tolerates a fleet of mismatched, flaky machines.
- **Split the model (inner loop, only when forced, expensive).** When a model is too large to fit on a single GPU, several nodes each hold *part* of it (pipeline/tensor parallel) and exchange activations **every micro-step**. This is bandwidth-brutal over the public internet, so it is reserved for small groups of high-bandwidth, co-located, reliable nodes.

We unify these with one abstraction — the **cell**:

> A **cell** is the set of nodes required to hold and train **one replica** of the model.
> - Model fits on one GPU → **cell = 1 node** (pure data-parallel; the easy, demoable case).
> - Model bigger than one GPU → **cell = a pipeline of nodes** (the hard, roadmap case).

Two further multipliers make the communication tractable:
1. **The trainable thing is a LoRA/QLoRA adapter**, not the full model. Even for a 70B base, the adapter we ship around is a few **megabytes**.
2. **DiLoCo-style infrequent sync** — cells run `H` local steps (e.g. 50–500) between merges, instead of an all-reduce every step.

The critical property: **the outer (data-parallel) loop is identical in both regimes.** You build the single-GPU version, then later let a "cell" mean more than one node. Nothing else changes.

---

## 2. Architecture at a glance

```
TRAINING JOB: fine-tune LoRA adapter θ on dataset D   (base model frozen, 4-bit)
                                  │
          ┌───────────────────────┴────────────────────────┐
          │  ROUND r — coordinator ships θ_global + a data   │
          │  shard to each CELL  (DATA-PARALLEL fan-out)      │
          └───────────────────────┬────────────────────────┘
            ┌──────────────┬───────┴───────┬───────────────────────┐
            ▼              ▼               ▼                        ▼
       ┌─────────┐   ┌─────────┐    ┌─────────┐         ┌────────────────────┐
       │ Cell A  │   │ Cell B  │    │ Cell C  │         │ Cell D  (ROADMAP)   │
       │ 1 node  │   │ 1 node  │    │ 1 node  │         │ pipeline of 2–3     │
       │ RTX 4090│   │ RTX 3060│    │ laptop  │         │ nodes — model too   │
       │ shard 1 │   │ shard 2 │    │ shard 3 │         │ big for one GPU     │
       └────┬────┘   └────┬────┘    └────┬────┘         └──────────┬─────────┘
       H local steps  H local steps  H local steps          H steps (pipeline-
        → Δ_A          → Δ_B          → Δ_C                  parallel) → Δ_D
            └──────────────┴───────┬───────┴───────────────────────┘
                                   ▼
                  ┌──────────────────────────────────────┐
                  │  OUTER OPTIMIZER  (DiLoCo)             │
                  │  θ_global ← OuterOpt(θ_global,         │
                  │     capability-weighted average of Δ)  │
                  │  log validation loss ↓ ; pay accepted  │
                  │  contributions to the MYC ledger       │
                  └────────────────────┬───────────────────┘
                                       │  round r+1
                                       └────────► loop until target loss / budget
```

Cells A–C (one node each, different hardware) are the **hackathon demo**. Cell D (a pipeline of nodes) is the **roadmap** upgrade for models that don't fit on one GPU — and is the *only* part that needs node-to-node networking.

---

## 3. How the sharding actually works

### Regime 1 — model fits on one GPU (cell = 1 node) → v1 + demo

This is the whole demo, and it rides Mycelia's existing `pull-work` / `submit-result` plumbing almost unchanged (a "round-task" instead of a render tile). **No node ever talks to another node.**

```
θ_global  =  current global adapter weights  (small: MBs)

Round r:
  1. Coordinator shards dataset D → D₁…Dₖ, and to each of k cells ships:
       (θ_global, data-shard ref, base-model ref, H, hyperparams)
  2. Cell i (one node):
       • load frozen base model (cached locally, 4-bit)
       • set adapter ← θ_global
       • run H local AdamW steps on shard Dᵢ          → local adapter θᵢ
       • pseudo-gradient  Δᵢ = θ_global − θᵢ           (DiLoCo)
       • upload Δᵢ (to S3, ref recorded in DSQL)        — a few MB
  3. Coordinator waits for a QUORUM (≥ m of k cells, bounded staleness), then
     OUTER OPTIMIZER step (DiLoCo: Nesterov momentum on the capability-weighted
     mean of Δ)                                         → new θ_global
  4. Evaluate θ_global on a held-out validation set; log loss; r += 1
```

`OuterOpt` defaults to **DiLoCo** (outer Nesterov momentum on the averaged pseudo-gradient). The simplest correct fallback is **FedAvg** (token-weighted average of local adapters). Both are a handful of lines on the adapter tensors.

### Regime 2 — model bigger than one GPU (cell = pipeline of nodes) → roadmap

A cell of `p` nodes splits the frozen base into `p` **pipeline stages** (layers partitioned by VRAM); LoRA adapters sit on each stage. Micro-batches flow forward `n₁ → nₚ` and gradients flow back (GPipe / 1F1B scheduling), exchanging **activations peer-to-peer every micro-step**. The cell as a whole produces one `Δ_cell` and plugs into the **exact same outer DiLoCo loop**.

What Regime 2 adds (and why it's deferred):
- **Node-to-node connectivity** — pipeline stages must stream activations to each other. The base plan deferred peer-to-peer to a later phase; big-model training is what pulls it forward (WebRTC / TURN relay / rendezvous service + NAT traversal).
- **High-bandwidth, co-located, reliable cells** — activation exchange is the bottleneck, so cell members should be same-region / same-LAN where possible, and drawn from the strongest, most reliable tier.
- **Heterogeneity-aware partitioning** — assign more layers to bigger-VRAM nodes and balance per-stage compute so the *slowest stage* (which gates the pipeline) is minimized.

For tensor-parallelism (splitting individual matmuls across nodes) the bandwidth demand is even higher; treat it as intra-node / intra-LAN only.

---

## 4. Handling heterogeneous hardware

This is the design's reason for existing — a top-tier 4090 and a mid-tier laptop GPU coexist via four mechanisms:

1. **Capability tiering.** Classify every node by VRAM, GPU TFLOPs, bandwidth, and reliability (reuse `nodes.capability_class`). Tiering drives cell formation and work assignment.
2. **Work proportional to capability — not an equal split.** Strong nodes get more local steps, larger micro-batches, or more data per round; the outer merge is **weighted by tokens processed**. A fast node legitimately contributes (and earns) more *without gating* slow nodes.
3. **Fit the model to the weakest hardware instead of excluding it.** **QLoRA 4-bit (NF4) base**, **gradient checkpointing**, **8-bit optimizer states**, and **ZeRO-style CPU/NVMe offload** for VRAM-tight nodes. A mid-tier card runs a bigger model slowly rather than not at all.
4. **Straggler & churn tolerance is free in the outer loop.** DiLoCo/FedAvg only needs a *quorum* of cells per round. A slow or dead cell's `Δ` is dropped and its shard reassigned; bounded staleness lets a cell be a round behind. (Inside a model-sharded cell a node death kills only that cell's round — small blast radius, because cells are small.)

**Demo angle:** deliberately use real nodes of different speeds, show the scheduler handing the fast node more work, and show the system still converging. That *is* the heterogeneity story, made visible on stage.

---

## 5. Why this is feasible over home internet (the communication budget)

The binding constraint is upstream home bandwidth, so we count bytes:

| Lever | Effect |
|---|---|
| **LoRA adapter, not full model** | Communicate ~MBs (rank 16 on a few target modules), not the multi-GB base. |
| **DiLoCo: sync every `H` steps** | Amortize that transfer over 50–500 steps of local compute → near-zero comm overhead. |
| **Token-weighted async merge** | No global barrier; no all-reduce; the slow node never blocks the fast ones. |
| **Roadmap: delta compression** | DeMo/DisTrO-style decoupled momentum + top-k / int8 quantized deltas + error feedback → push `H` down and scale cells up. |

Net: in Regime 1 the per-round upload per node is a few MB every few minutes of local training. That is the entire reason this works on consumer connections — and why **model-parallel (Regime 2) must stay inside high-bandwidth cells**, where activation traffic never crosses the slow WAN link.

---

## 6. The training-job lifecycle on Mycelia's control plane

A training job is a sequence of **rounds**; each round is a fan-out of **round-tasks** (vs. render tiles). It maps onto the existing stateless coordinator:

| Step | What happens | Reuses |
|---|---|---|
| **Submit** | User uploads base-model ref + dataset ref + LoRA config (rank, α, target modules, `H`, max rounds, target loss); escrow funded | `/submit` + escrow ledger |
| **Form cells** | Coordinator groups available nodes into cells matched to model size & bandwidth (1 node in Regime 1) | scheduler (**new**) |
| **Dispatch round** | Each cell pulls `(θ_global, data-shard ref, base-model ref, hyperparams)` | `/pull-work` (round-task) |
| **Local train** | Cell runs `H` steps → `Δ` (adapter delta) → S3, ref in DSQL | `/submit-result` |
| **Aggregate** | Quorum reached → outer optimizer step → new `θ_global`; validation loss logged | `/settle`-style **aggregation worker (new)** |
| **Settle credits** | Accepted contributions paid (capability- & contribution-weighted); rejected ones earn nothing / are slashed | ledger (**unchanged**) |
| **Loop** | Until target loss / round budget / escrow exhausted; final adapter published to S3 | — |

The **aggregation worker** is the one genuinely new server-side primitive: read the round's `Δ` refs from DSQL, compute the capability-weighted outer step, write the new global adapter to S3, bump the round. It is small and stateless-friendly (all state in DSQL + S3), so it sits comfortably in the same architecture as `/settle` — and graduates to a Fargate worker on the roadmap exactly like the render settlement worker.

### Data-model additions (DSQL)

New tables, integrity enforced in-app within transactions (no FKs), consistent with [`PLAN.md` §5](../PLAN.md):

```sql
training_jobs(id UUID PK, requester_id UUID,
  base_model_ref TEXT, dataset_ref TEXT,
  lora_config JSONB,            -- {rank, alpha, target_modules, dropout}
  h_local_steps INT, max_rounds INT, target_val_loss NUMERIC,
  current_round INT, global_adapter_ref TEXT, val_loss NUMERIC,
  status ENUM['queued','running','aggregating','completed','failed'],
  reward_bid_myc NUMERIC, created_at)

training_rounds(id UUID PK, job_id UUID, round_index INT,
  adapter_ref_in TEXT, adapter_ref_out TEXT, val_loss NUMERIC,
  quorum_required INT, deltas_received INT,
  status ENUM['dispatched','aggregating','done','timed_out'],
  started_at, aggregated_at,
  UNIQUE(job_id, round_index))

cells(id UUID PK, job_id UUID, round_id UUID,
  kind ENUM['solo','pipeline'], member_node_ids UUID[],
  capability_class TEXT, data_shard_ref TEXT,
  status ENUM['forming','assigned','training','submitted','dropped'],
  assigned_at, deadline_at)

contributions(id UUID PK, round_id UUID, cell_id UUID, node_id UUID,
  delta_ref TEXT, tokens_processed BIGINT, local_steps INT,
  canary_loss_delta NUMERIC,        -- validation signal (see §7)
  accepted BOOL, reward_myc NUMERIC,
  vote_status ENUM['pending','accepted','rejected','recompute_pass','recompute_fail'])
```

`contributions` feeds `ledger_entries` exactly like verified render tiles — escrow-until-verified applies unchanged: a contribution is paid only once accepted.

---

## 7. Verifying training contributions

Training is **non-deterministic across hardware** (floating-point + kernel differences), so bitwise voting is impossible. Layered, pragmatic → hard:

- **Contribution validation (demo-grade, build this):** does the submitted `Δ` actually *reduce loss* on a small **canary batch** the coordinator controls? Plus gradient-norm sanity and cosine-similarity to the running aggregate, to reject garbage or poisoned deltas. Cheap, server-side, and visibly demoable (show a bad delta get rejected).
- **Redundant shards + directional agreement (roadmap):** occasionally assign one shard to two cells; accept if their `Δ`s are directionally consistent (cosine sim above threshold).
- **Refereed recompute / Proof-of-Sampling (roadmap):** a referee re-runs a node's claimed local steps from the same seed + data + base and checks the `Δ` matches within tolerance; stake-weighted spot-checks make cheating negative-EV. This is the **same Phase-5 verification moat already in [`PLAN.md` §8](../PLAN.md)** — training is just another workload class for it (Gensyn-style refereed delegation generalizes here).
- **Reputation + staking:** nodes stake; accepted contributions build reputation and unlock less redundancy; rejected/failed ones slash.

> Engineering honesty (internal): robustly verifying *training* contributions from untrusted nodes is an open research problem. For the demo, canary-loss validation + reputation is sufficient and defensible. Do not claim the refereed-recompute layer is built.

---

## 8. Data & base-model distribution

- **Public / non-sensitive data only in v1** — consumer GPUs have no usable TEE, so we assume the host can read the job (matches [`PLAN.md` §8](../PLAN.md) confidentiality scope). Confidential training is out of scope.
- **Dataset** is sharded in S3; cells pull their shard by short-lived presigned ref.
- **Base-model cold start is the real cost.** Every node needs its base weights (GBs even quantized). Mitigations: aggressive local caching, pre-staging the base on known/returning nodes, content-addressed chunks, and — for the demo — **pre-loading the base so stage time isn't dominated by a multi-GB download.** Call this out to judges as a known engineering item, not a surprise.

---

## 9. The hackathon demo slice (concrete)

Scoped hard to **Regime 1 (cells = 1 node)** so it is genuinely buildable and tells the whole story — **no peer-to-peer, no model sharding.**

- **Base model:** a small open model that fine-tunes fast on a consumer GPU — e.g. **Qwen2.5-0.5B / 1.5B** or **Llama-3.2-1B / 3B**, loaded in **4-bit**, **LoRA rank 16** on attention projections.
- **Dataset:** a small, public instruction/style dataset; sharded across cells.
- **Fleet:** your **3+ real nodes** (teammate GPUs/laptops, *deliberately different speeds*) + simulated cells. Each runs `H ≈ 50–200` local steps per round and returns the adapter delta.
- **Hero visual:** a live chart of **global validation loss dropping round-by-round** as deltas fan in and merge — the training analogue of the Mandelbrot reassembly. Plus per-node contribution bars and MYC credits ticking up. Show the fast node doing more work and the system still converging — heterogeneity, made visible.
- **Verification beat:** inject a deliberately bad delta and show the canary-loss check reject it.
- **Payoff:** download the trained adapter — "this adapter was fine-tuned across N strangers' idle GPUs."

### Demo acceptance criteria (measurable)

1. A real training job fans out to **≥ 3 real nodes** of differing capability, each completing ≥ 1 round.
2. **Global validation loss decreases** across rounds, visibly, within the demo window.
3. A **deliberately-bad delta is rejected** by the canary-loss check.
4. **MYC credits** are awarded per accepted contribution, **weighted by tokens processed**, through the existing ledger.
5. The final **trained adapter is downloadable** and loads back onto the base model.
6. The system **completes the run even if a real node drops mid-round** (sim cells + quorum carry it).

---

## 10. Roadmap (the deferred hard parts)

| Phase | Capability | Why deferred |
|---|---|---|
| **Demo / v1** | Data-parallel LoRA, cells = 1 node, DiLoCo/FedAvg outer loop, canary-loss verification, loss-drop dashboard | The achievable, fully-demoable slice |
| **Next** | **Communication compression** (DeMo/DisTrO decoupled momentum + top-k/int8 deltas + error feedback) | Pushes `H` down, scales cell count up |
| **Next** | **Refereed-recompute verification** for training | Open problem; reuses the Phase-5 PoSP moat |
| **Hard** | **Model-sharded cells** (pipeline/tensor parallel) for models > 1 GPU | Needs node-to-node networking (WebRTC/relay), activation compression, heterogeneity-aware partitioning |
| **Moonshot** | **Full pretraining from scratch** (DiLoCo-class) | Communication- and reliability-bound at frontier scale |
| **Future feature** | **Distributed inference serving** (pipeline-parallel large-model serving) | Different (latency-sensitive) problem; separate track |

---

## 11. What this adds to the build (team mapping)

This is **Lane 6 (AI / agentic)'s** deepest workstream, but it crosses lanes:

- **Training client** — runs **natively on the node, not in the browser.** Serious ML training wants Python (PyTorch + PEFT + bitsandbytes) or a Rust worker, not a throttled browser tab. *Implication:* the browser stays the onboarding funnel; **ML training is a native-client capability** and leans on the native-daemon track, not the WebGPU browser worker (Lane 4).
- **Aggregation worker + scheduler** (cell formation, outer optimizer, quorum, staleness) — backend; leans on Lanes 1–2 (data + coordinator core) and reuses the `/settle` pattern.
- **Loss-drop / contribution dashboard** — frontend; Lanes 3–4.
- **Data model + ledger wiring** for `training_jobs` / `rounds` / `cells` / `contributions` — Lane 1.

---

## 12. Key risks & open decisions

| Risk / decision | Note |
|---|---|
| **Base-model cold-start (GBs)** | Dominates stage time if unmanaged. Cache + pre-stage + (demo) pre-load. |
| **Convergence with heterogeneous, dropping cells** | DiLoCo/FedAvg is empirically robust but needs tuning (`H`, outer LR, quorum). Budget time to tune on real mixed hardware. |
| **Model-sharded cells need P2P** | Pulls forward networking the base plan deferred. Keep it out of the demo. |
| **Verifying training is unsolved** | Canary-loss + reputation for now; refereed-recompute is roadmap. Don't overclaim. |
| **Native client required for training** | Confirm the team can ship a small native Python/Rust training worker; otherwise demo runs on teammates' machines via a script. |
| **Open decision — outer optimizer** | Start FedAvg (simplest, correct), upgrade to DiLoCo Nesterov once the loop works. |
| **Open decision — demo base model & dataset** | Pick the smallest model that still shows a believable loss drop fast on a consumer GPU. |

---

## 13. References / further reading

- **DiLoCo** — Douillard et al., "DiLoCo: Distributed Low-Communication Training of Language Models" (low-comm data-parallel; the outer-optimizer backbone here).
- **OpenDiLoCo / INTELLECT-1 / INTELLECT-2** — Prime Intellect (open implementations + real decentralized training runs across the internet).
- **DeMo / DisTrO** — Nous Research (decoupled-momentum gradient compression; the comm-compression roadmap item).
- **QLoRA** — Dettmers et al. (4-bit NF4 base + LoRA; how mid-tier GPUs fit big models).
- **ZeRO-Offload / DeepSpeed** — Microsoft (CPU/NVMe offload for VRAM-tight nodes).
- **GPipe / 1F1B (PipeDream)** — pipeline-parallel scheduling for model-sharded cells.
- **Petals / Exo** — distributed inference & training across consumer/edge devices (Regime 2 prior art).
- **Gensyn (Verde, refereed delegation)** — verifiable decentralized ML; the verification moat generalized to training.
- **FedAvg** — McMahan et al. (federated averaging; the simplest correct outer merge).
