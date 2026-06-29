# Mycelia — Master Project Plan

> **A shared compute cloud woven from everyday people's idle computers.** Many small nodes, one living compute organism.

> **Scale-to-a-million target:** one million registered requesters and contributors across regional control planes. Every worker interaction is constant-size and pull-based; no operation requires broadcasting to, locking, or synchronizing the full fleet.

**Status:** Greenfield. Canonical repo root **verified** at `/Users/sairamen/projects/Mycelia` (remote `GodlyDonuts/Mycelia`). A nested `Mycelia/Mycelia/.git` exists with only a 10-byte stub README pointing at the **same** remote — it must be collapsed in Phase 0 before any v0 push (see [Roadmap](#10-build-roadmap)). Re-verified directly: both `/Users/sairamen/projects/Mycelia` and the nested `/Users/sairamen/projects/Mycelia/Mycelia` are git repos with the identical `https://github.com/GodlyDonuts/Mycelia.git` remote and 10-byte stub `README.md` files — collapsing the inner `.git` is safe.

**The one decision that defines this plan:** we build the *read path and the proof* for real, and we **stub the async control plane** for the hackathon. Mycelia is a trust-and-economics company that happens to do distributed systems. We ship something genuinely live and scope it ruthlessly.

**What we ship at the demo:** a live, end-to-end product on the 2026 stack — natural-language job submission via **Claude Opus 4.8**, real **WebGPU** GPU compute running on stage, a passwordless **Aurora DSQL**-backed marketplace, and the compute mesh exposed as a read-only **MCP server**. Concretely: an escrow-until-verified credits ledger that settles on real tile completions with concurrency-safe debits, and a working distributed render that fans out across a live mesh of contributor nodes (teammate laptops + phone browser tabs) and reassembles into one image — plus a clear roadmap to global scale and to the harder workloads: untrusted-code verification, sandboxing, and confidential compute.

---

## 1. Vision & the problem

### The crisis

AI's compute appetite is colliding with physical limits:

| Pressure | Reality |
|---|---|
| **Power** | Global data-center electricity ~doubles from **~485 TWh (2025) → ~950 TWh (2030)** (~3% of world demand). AI data-center power surged **~50% in 2025**. |
| **Water** | AI data centers drew **~264 billion gallons in 2025** (~1.8M Americans' annual use); Phoenix-area DC water use projected to rise **~870%**. ~2/3 of post-2022 DCs sit in water-stressed areas. |
| **GPUs** | H100/H200 lead times run **36–52 weeks**; H100 rental up **~40%** since late 2025; the crunch is expected to persist into ~2027. |

Meanwhile, **billions of consumer devices sit 85–90% idle** — hundreds of millions of gaming PCs and laptops, already powered, already cooled, already connected.

### What Mycelia is

> **Mycelia is a two-sided marketplace that weaves idle consumer CPUs and GPUs into a datacenter-class compute cloud.** Contributors run a lightweight client (browser tab today, native daemon tomorrow) and earn **MYC credits** for completing latency-tolerant batch jobs — rendering, batched AI inference, Monte Carlo, scientific sims. Requesters submit those jobs and pay far below hyperscaler prices. Because Mycelia **reuses hardware that already exists, is already cooled, and is already connected**, it requires **no new land, datacenter buildout, or grid interconnect** — the most defensible, least-contested wedge in the entire DePIN field.

**The sustainability wedge.** The defensible, uncontested claim is **no new land, no datacenter construction, no new water-cooling plant, and no new grid interconnect** — Mycelia sidesteps the contested, multi-year, permit-bound costs of hyperscale buildout entirely. We harvest **only otherwise-idle time** and let contributors schedule onto cheap/off-peak/renewable windows, shifting *when* and *where* the incremental draw lands. This is the most defensible, least-contested environmental story in the entire DePIN field.

The thesis is **already proven** (Salad runs 60k+ daily-active consumer GPUs across 191 countries; BOINC/Folding@home ran millions of nodes for two decades, hitting 2.43 exaFLOPS). We do **not** need to prove "consumer compute works." We need to **out-execute on the three genuinely unsolved problems**: verifying untrusted results without doubling cost, protecting job data on a TEE-less host, and paying contributors enough to beat their marginal electricity.

### The million-participant contract

"Scale to a million" means the architecture must remain operational as registered users, online nodes, jobs, and result volume grow independently. It does **not** mean the hackathon laptop or embedded database is represented as a million-concurrent-user benchmark.

1. **No fleet-wide coordination.** A worker pulls one shard, renews one lease, and submits one result. Work is partitioned by job, capability, and region.
2. **No in-memory authority.** Coordinator instances are disposable; leases, job state, idempotency, and balances are durable.
3. **No unbounded telemetry table.** Current telemetry is one row per node. At production volume, regional telemetry shards are independent of the strongly consistent ledger.
4. **No artifact hairpin through the coordinator.** Models, datasets, checkpoints, and outputs move through object storage or direct data paths; the control plane carries references.
5. **No global failure domain.** Regional ingress, queues, workers, and TURN capacity isolate congestion and node churn.
6. **No verify-everything-twice tax.** Sampling, reputation, deterministic checks, and dispute-driven referees keep trust cost proportional to risk rather than fleet size.
7. **No rewrite at the scale boundary.** The local PGlite driver is replaced behind `lib/db/index.ts`; the request contracts, SQL invariants, worker protocol, and workload state machines remain.

Before claiming production readiness, this contract requires measured regional load tests, queue-lag targets, storage hot-key tests, chaos drills, and cost-per-active-node evidence.

### The metaphor, mapped to the architecture

| Mycelium | System component |
|---|---|
| **Spores** | Worker nodes — dumb, mutually-distrustful, never talk to each other |
| **Hyphae** | The network threads — job dispatch + result/heartbeat flow back to the center |
| **Fruiting body** | The centralized control plane that routes nutrients (jobs) and rewards (credits) |
| **The organism** | The aggregate cloud — antifragile to any single node dying |

The metaphor is marketing. The architecture is deliberately **server-centric like BOINC and Salad** — centralized control plane, no P2P (deferred to v3+; it adds NAT traversal, consensus, and trust complexity for zero early benefit).

---

## 2. How it works

### The two-sided model

- **Contributors ("Cultivators")** — everyday people donate idle compute *only when the machine is otherwise unused*, with hard thermal/power caps and instant yield when the user returns. They earn region- and reliability-weighted **MYC credits**.
- **Requesters** — teams squeezed by GPU scarcity submit containerized, embarrassingly-parallel batch jobs, paid into **escrow** and released only on **verified** completion.

### Lifecycle of a job

```
SUBMIT      Requester posts a job; funds move to escrow in ONE transaction that
   │        debits the requester's available balance via a serialization point
   │        (see §4 — escrow-overdraft race). Returns immediately; no long loop.
   │
SCHEDULE    /submit writes job + all tile rows (status='pending') and returns.
   │        No persistent scheduler process: capability + deadlines are columns
   │        on the tile rows; matching is a WHERE clause at claim time.
   │
FAN-OUT     Workers PULL work: each POST /pull-work is a sub-second stateless
   │        handler doing ONE conditional, randomized UPDATE WHERE status='pending'
   │        with 40001 retry. Nodes never talk to each other.
   │
EXECUTE     Each worker runs the tile in a sandbox (MVP: our own trusted kernel)
   │        and POSTs a result hash + blob reference.
   │
VERIFY      MVP: deterministic self-check of our own deep-zoom fractal kernel
   │        (the WGSL compute output is deterministic and self-verifiable).
   │        Roadmap (Phase 5): stake-weighted Proof-of-Sampling (PoSP) +
   │        refereed-delegation recompute — a referee binary-searches the
   │        compute graph to the first divergent op, with the cross-architecture
   │        FP problem addressed per workload class (see §8).
   │
REASSEMBLE  When the final deep-zoom fractal tile flips to 'verified', the /submit-result handler
   │        writes a `ready_to_settle` marker; a separate short /settle endpoint
   │        (server-authoritative) re-checks all-tiles-verified, stitches the
   │        image, and settles. Reassembly is never held in a single long request.
   │
SETTLE      Chunked DSQL transaction(s), append-only: escrow_release → provider_earn
            + platform_fee, refund unused. Balance = SUM of signed ledger entries.
            Payouts batched to stay under the 3,000-row transaction cap.
```

The **organizing economic principle** is *escrow-until-verified*: a requester's funds are held until a tile's result passes verification, then released to the contributor; cheaters are slashed; unused escrow is refunded. This makes the ledger economically correct from day one even though **redemption (cashing out MYC) is deliberately cut from the MVP**.

---

## 3. System architecture

A **two-tier split**, because Vercel is excellent for UI + read-path but weak for background jobs, queues, schedulers, and long-running compute.

### The hard constraint that shapes this section: no long-running process on Vercel

Vercel serverless/Fluid functions have a **hard wall-clock cap** (default ~10 s Hobby, ~60 s Pro; ~300 s max even with streaming on paid tiers) and **no persistent process between requests**. A scheduler that must hold tile-queue state across a multi-cycle polling render therefore **cannot** live inside a Route Handler or Server Action. The original "one long-ish Server Action for chunking" framing violated our own rule and is removed. The corrected design below has **no server-side loop anywhere in Tier 1**.

### Tier 1 — Vercel + v0 (built for real; the demo path)

The v0-generated Next.js App Router app on Vercel. **All UI, the entire read path, and a set of fully request-driven, stateless coordinator endpoints.** Server Components / Route Handlers / Server Actions talk **directly** to one Aurora DSQL cluster via a single shared pooled connection in `lib/db/` with a cached, auto-refreshed IAM token. Live updates use **short-interval polling (1 s during the active render beat, 3 s otherwise) or SSE — never self-hosted WebSockets** (they flake on Vercel serverless).

**The coordinator is a set of stateless, sub-second handlers, not a loop.** State lives entirely in DSQL; no handler holds scheduler state across requests:

| Endpoint | What it does (single invocation, sub-second) |
|---|---|
| `POST /submit` | Inserts the job row + all tile rows (`status='pending'`), debits escrow via the serialization point (§4), returns. |
| `POST /pull-work` | One **randomized** conditional `UPDATE tiles SET status='claimed', assigned_node_id=$n WHERE id = (SELECT id FROM tiles WHERE job_id=$j AND status='pending' ORDER BY random() LIMIT 1)`, with **40001 retry-with-backoff**. Returns the claimed tile or "none available." |
| `POST /submit-result` | Records the result, runs the MVP deterministic self-check, flips the tile to `verified`. If it is the **last** tile (`completed_tiles == total_tiles`), writes a `ready_to_settle` marker row in the same transaction. |
| `POST /settle` | Server-authoritative: re-verifies *all tiles verified* inside the transaction, reassembles, releases escrow, pays providers — **chunked** to stay under the 3,000-row cap. Triggered by a one-shot poll or the local coordinator script, **never** by an untrusted client as the payment authority. |

**Where the "loop" actually lives:** there is no loop in Tier 1. The only thing that resembles orchestration — periodically nudging `/settle` and detecting completion — runs either as (a) a **client poll** that *detects* `completed_tiles == total_tiles` and *requests* settlement (the server then re-verifies authoritatively), or (b) the **local coordinator/simulator Node script on the demo laptop** (see Tier 2). We pick **(b) drives the demo, (a) is the fallback**. The browser is never the payment authority.

### Tier 2 — the control plane (STUBBED for the hackathon, real on the roadmap)

This is the actual distributed-systems core. **The single most important decision in this plan is to NOT build the real AWS backend for the hackathon.**

- **For the demo:** a single **local Node/TS script on the demo laptop** that fuses the *coordinator driver* and the *simulator*. It (i) kicks `/submit`, (ii) drives the simulated fleet's claims/results, (iii) polls for completion and calls `/settle`. Because it is a real long-lived local process, it is the correct home for any state or timing the stateless Vercel endpoints cannot hold. It connects to DSQL through the **same shared-pool discipline** as Tier 1 (see §4 — this is a hard mandate, not optional).
- **On the roadmap:** it graduates to a real AWS backend — **API Gateway + Lambda** (intake / pull-work / heartbeat / result submit), **EventBridge + SQS** (tile dispatch + DLQ + settlement events), a small **ECS/Fargate scheduler** (capability matching, straggler detection, speculative execution), a **Fargate verification worker** (voting + reputation + seeded challenges), and a **settlement worker**.

> For the hackathon we build the read path and ledger; the async AWS backend (SQS/EventBridge/Fargate) is the post-hackathon roadmap. The MVP coordinator is fully request-driven, so graduating to the async backend is additive, not a rewrite.

### Compute clients

- **Demo primary: browser "Join the mesh" worker** — zero-install, a real node appears in ~2 s. On the **pre-warmed Chromium stage machine** this is a real **WGSL compute-shader kernel on WebGPU** (GA across major browsers since Nov 25, 2025) computing **deep-zoom fractal tiles** at high iteration depth, with the per-dispatch GPU timestamp shown live so WebGPU is visibly doing real GPU work. Everywhere else the client **feature-detects** WebGPU and falls back to a **TypeScript-on-CPU Web Worker** — so the workload runs everywhere, with the GPU showcase reserved for the machine we control.
> **Internal engineering note (WebGPU scope):** run WebGPU **only on the Chromium machine we control** — never the judge's arbitrary laptop (Safari pre-26, Firefox on Intel-Mac/Linux, and backgrounded-tab throttling all silently degrade to CPU, so feature-detect → CPU Web Worker everywhere else). **Do NOT set COOP/COEP headers** for this demo — WebGPU compute does not need `SharedArrayBuffer`/cross-origin isolation (that's only for multi-threaded WASM), and setting it "to be safe" can break the Anthropic fetch, CDN assets, and the v0 preview iframe.
- **Roadmap primary: native Rust daemon** — full multicore CPU + GPU via `wgpu` (Vulkan/Metal/DirectX), proper OS background service (launchd/systemd/Windows SCM), idle detection, small footprint (Tauri/raw-Rust, **not** Electron). This is the real *supply engine*; it is **not** the stage demo.

**Why the browser is a funnel, not a supply engine (the throttling reason, stated explicitly):** every modern browser **aggressively throttles a backgrounded/inactive tab** — `setTimeout`/`setInterval` clamped to roughly once per minute, `requestAnimationFrame` paused. So the moment a contributor switches tabs, a "Join the mesh" tab does **almost no useful work**, directly at odds with "donate idle compute." The browser client is therefore an **onboarding and demo funnel**; the **native daemon is the real supply engine**, and we connect the two facts explicitly rather than implying the tab is a serious harvester. The on-stage WGSL/WebGPU kernel is the **showcase** of what a browser node *can* do on hardware we control — not a claim that every joining tab does serious GPU work; backgrounded tabs still throttle, which is exactly why the daemon is the supply engine. *(Internal: if we ever pursue multi-threaded WASM in the browser it would require cross-origin isolation via COOP/COEP headers to enable `SharedArrayBuffer` — but the WebGPU compute path does **not**, so we deliberately do not set those headers here.)*

The roadmap goal of "one job artifact, two clients" is stated **as a roadmap goal, not an MVP fact**: native Wasmtime/WASI and browser WASM+WebGPU are *different* runtime and I/O surfaces, so single-artifact portability is non-trivial and untested. The MVP runs a hardcoded deep-zoom fractal kernel per client (a WGSL compute kernel on the WebGPU stage path; the equivalent TS-on-CPU kernel on the fallback path).

### Sandboxing & verification (roadmap; MVP runs a trusted kernel)

- **Host protection (roadmap):** the design is that every untrusted job runs in a **WASM/WASI sandbox via Wasmtime**, capability-denied-by-default. GPU/native jobs that can't target WASM fall back to **Firecracker microVM or gVisor** — never a raw binary on the host. For the MVP we run **only our own trusted deep-zoom fractal kernel**, so this is out of MVP scope.
- **Result verification (roadmap):** stake-weighted **Proof-of-Sampling (PoSP)** + **refereed-delegation recompute** (Gensyn Verde / RepOps fixed-order-kernel lineage) — a referee binary-searches the compute graph to the first divergent op and recomputes only that, while stake-weighted spot-checking makes cheating negative-EV for rational actors, with a trusted-recompute backstop for high-value jobs and collusion. The hard sub-problem (cross-architecture floating-point nondeterminism) is addressed per workload class in §8. For the MVP the only verification is a **deterministic self-check of our own deep-zoom fractal kernel** (its WGSL compute output is deterministic, so the self-check property still holds).

### Live transport — SSE on Vercel Fluid Compute + `after()`

The live mesh telemetry rides **Server-Sent Events on Vercel Fluid Compute** (GA) — one Fluid function multiplexes many live mesh connections and is the **explicit carrier of the 1 s active-render beat** (3 s idle). Post-response dashboard-view/audit writes fire via **`after()`** (stable), off the critical path. **Polling stays the fallback**, and there are **no self-hosted WebSockets**.

> **Internal engineering note (SSE/Fluid):** in-function concurrency means shared module state across requests — write SSE handlers to hold **no per-connection state in module scope**. The demo lives well inside the 300 s / 800 s GA window; don't lean on the 1800 s beta limit. (There is no turnkey "Vercel Realtime" WebSocket product — we build SSE on Fluid Compute.)

### Agentic surface — read-only MCP server (built LAST)

The compute mesh is wrapped as a **read-only MCP server**: the existing stateless read endpoints are exposed as MCP tools — `get_mesh_status`, `list_nodes`, `get_job_progress`, `explain_settlement` — via Vercel's `mcp-handler` (Streamable HTTP) in `app/[transport]/route.ts`, pinning `@modelcontextprotocol/sdk >= 1.26.0`. So an agent can read the live mesh, inspect job progress, and explain a settlement, while the ledger stays server-authoritative.

> **Internal engineering note (MCP):** built **LAST**, after the six must-haves and the WebGPU hero are green; **read-only only**. `/settle` is **not** an MCP-authorizable tool — the agent may *request*, never *authorize*, settlement. `submit_job` / `request_spot_check` are roadmap or gated behind explicit confirmation. A scoped token is fine for the demo; pin the SDK at `>= 1.26.0` (earlier versions had a security vuln).

### Component diagram

```
                          ┌─────────────────────────────────────────────┐
                          │                 TIER 1 (REAL)                │
   Browser ──"Join the    │   v0 / Next.js App Router on Vercel          │
   mesh" (WGSL/WebGPU on  │   ┌─────────────┬──────────────┬──────────┐  │
   stage; CPU Web Worker  │   │ Dashboard   │ Marketplace  │Telemetry │  │
   fallback elsewhere)    │   │             │ + Submit     │+ landing │  │
        │                 │   └─────────────┴──────────────┴──────────┘  │
        │ /pull-work      │             │  lib/db/ (ONE pooled conn,      │
        │ /submit-result  │             │   cached IAM token, 40001 retry)│
        │ (stateless,     │             ▼                                 │
        │  sub-second)    │                                               │
        ▼                 │   STATELESS COORDINATOR ENDPOINTS:            │
   ┌──────────┐           │   /submit /pull-work /submit-result /settle   │
   │ DRIVER +  │◄─────────┼──────► Aurora DSQL  ◄──── strongly-consistent  │
   │ SIMULATOR │  same     │      (single source       fresh reads        │
   │ (local    │  shared   │       of truth; ALL        + ALL scheduler    │
   │ Node      │  pool     │       coordinator          state lives here)  │
   │ script on │  mandate  └─────────────────────────────────────────────┘
   │ the demo  │                       ▲
   │ laptop)   │                       │ same tables, ONE shared pool
   └─────┬─────┘                       │
         │ kick /submit, drive sim      │
         │ claims, poll, call /settle    │
         ▼                              │
   ┌───────────────┐    ┌───────────────┴────────────┐
   │ N≥3 REAL      │    │ SIMULATOR (in the same      │
   │ workers       │    │ local script): 50 nodes     │
   │ (teammate     │    │ (demo) self-PARTITION tile  │
   │ laptops +     │    │ ranges → no claim contention│
   │ phone tabs)   │    │ heartbeat UPSERT @ T=3s via │
   └───────────────┘    │ ONE shared pool, self-partitioned │
                        └────────────────────────────┘

   ── — — — — — — — ROADMAP (post-hackathon) — — — — — — — — — — — ──
   API Gateway + Lambda → SQS/EventBridge → Fargate scheduler →
   verification worker → settlement worker → DSQL ledger
```

---

## 4. The AWS database decision

### Recommendation: **Amazon Aurora DSQL** (single cluster, single source of truth)

All three source designs converge on DSQL, and they are correct. DSQL is the **only** option that satisfies every Mycelia constraint at once:

| Constraint | How DSQL satisfies it |
|---|---|
| **Correct, no-double-spend ledger** | PostgreSQL-compatible **ACID** with snapshot isolation + OCC — debit + credit in **one transaction**. The single correctness-critical requirement (with the overdraft caveat addressed below). |
| **Fresh dashboard reads, no read store** | Strongly-consistent fresh reads serve Vercel dashboards **directly** — removes an entire tier. |
| **Cold-start posture on the live demo** | Genuinely serverless, scale-to-zero; we keep the cluster warm through the demo (see warmup below). |
| **Hackathon budget** | Permanent free tier (**100k DPUs + 1 GB/mo**) — effectively free at our scale; matters because the **$100 AWS credit only lasts 6 months**. |
| **Cleanest Next.js connection** | First-party **Vercel Marketplace integration** + Next.js starter using **OIDC federation + 15-min IAM tokens** — **zero static DB password**, the strongest "modern AWS" demo piece. |

**The historical blocker is gone.** DSQL added identity columns/sequences (Feb 2026), **JSON (May 2026)**, and **JSONB-with-compression (June 8, 2026)** — so semi-structured telemetry/capability payloads are now first-class.

### Keeping the cluster warm

DSQL scales to zero, and a first query against a slept cluster incurs a resume latency we **measure and record during Phase 0**, then put the actual number in the deck. We keep the cluster warm through the demo so the resume latency never lands on stage:

- A **keep-alive ping every ~4 minutes for the entire demo session** (not a one-shot 30 s pre-warm), so the cluster never re-sleeps mid-demo even if judges run long or there's a Q&A pause. The 4-minute cadence also stays comfortably inside the 15-minute IAM-token lifetime.
- Pre-seed tables ~30 s before so the first live read returns real rows.
- If the measured resume latency is high enough to threaten the first-minute gate, the keep-alive makes it moot — the cluster is already warm.

### The ledger consistency story (provably correct against replay **and** the escrow-overdraft race)

The credits ledger is the one place correctness is non-negotiable. We make it correct against **both** known failure modes and state exactly how:

- **Append-only** `ledger_entries` with a **signed `amount_myc`** and an `entry_type` enum (`escrow_hold` / `escrow_release` / `provider_earn` / `platform_fee` / `refund` / `slash`).
- **Balance is a DERIVED `SUM`** per account on the *credit/payout* side — never a mutated hot row, which minimizes OCC contention on the high-frequency provider-earnings path.
- Every settlement is **one DSQL transaction** with a mandatory **SQLSTATE 40001 retry-with-backoff** under OCC contention.
- A **`UNIQUE` `idempotency_key`** guarantees idempotent settlement — re-running settlement can never double-credit. **This prevents replay of the *same* settlement; it does not by itself prevent two *different* overdrafting debits.**

**The escrow-overdraft race, and how we close it.** Derived-`SUM` balance under OCC does **not** prevent a requester from over-committing escrow across two *concurrent* submits: each transaction reads the same available balance at snapshot time, each passes an app-level "sufficient funds" check, and each inserts a different `escrow_hold` row — and because the two writes touch *different* rows, **neither conflicts under OCC and both COMMIT**, overdrafting the account. With no FKs and no DB-side constraint, nothing catches it. We fix this with an explicit **serialization point on the debit path only**:

- **Chosen mechanism (a): a single per-account `account_balance` row** holding `available_myc` and `reserved_myc`. Every `escrow_hold` (a balance-affecting debit) performs a conditional `UPDATE account_balance SET available_myc = available_myc - $amt, reserved_myc = reserved_myc + $amt WHERE account_id=$a AND available_myc >= $amt` **inside the same transaction** as the `escrow_hold` insert. Two concurrent holds now **both touch that one row**, so OCC forces one to abort with 40001; it retries against the updated balance and either succeeds or correctly fails the funds check. We deliberately accept hot-row contention **only on the debit path**, which is **low-frequency** (job submits), while keeping the high-frequency provider-earnings credits on the contention-free derived-SUM path.
- **MVP simplification, also stated:** for the hackathon, requesters are **pre-funded internal accounts** seeded with MYC, so real-money overdraft cannot occur at the demo; we still implement mechanism (a) because it is cheap and demonstrates the correct design. **Real-money overdraft prevention and the reconciliation job are a Phase 2/5 correctness item**, called out explicitly rather than implied-done.
- The accuracy invariant `available_myc + reserved_myc == SUM(signed ledger entries for that account)` is checked by a **post-commit reconciliation sweep** (see Test strategy, §6) so the denormalized balance row can never silently drift from the append-only ledger.

So the ledger is **provably correct against settlement replay (idempotency_key) and against concurrent overdraft (the per-account serialization row)**; the full real-money debit path graduates from pre-funded internal accounts in Phase 2/5.

### How the Next.js/Vercel layer connects

- **Auth:** Vercel Marketplace AWS integration → OIDC federation → DSQL 15-min SigV4 IAM tokens. No long-lived secret — **v0 scaffolds the integration; we verified the role/trust config**. Env vars (`AWS_ROLE_ARN`, `AWS_REGION`, DSQL endpoint) in Vercel; pulled locally with `vercel env pull`. *(Internal: the same unified-IAM story covers the Claude Opus 4.8 structured-output call; do not claim Bedrock supports Anthropic managed-agent / MCP server-side tools — only the Anthropic-operated Claude Platform on AWS does.)*
- **Connector:** the **first-party AWS DSQL Node.js connector (Feb 2026)** in `lib/db/` replaces the hand-rolled IAM-token plumbing.
- **Pooling (engineering priority #1 — see [Risks](#12-risks--mitigations)):** **ONE shared pooled connection** in `lib/db/`, wrapped with `attachDatabasePool` from `@vercel/functions`, with the connector minting/caching the IAM token, token **cached and refreshed before the 15-min expiry**, connection **reused** across invocations. A `new Pool()` per request hits DSQL's **100-new-connections/sec/cluster** limit (hard, non-configurable, error `53400`) and is *the single most likely thing to silently break the live demo*. **This mandate explicitly extends to the local coordinator/simulator script** (see §7-adjacent budget below) — the demo-killer otherwise lives in the un-pooled quick-hack code, not in `lib/db/`.

### DSQL footguns we engineer around

1. **No foreign keys** → enforce referential integrity **in-app, within the transaction**.
2. **No triggers/views** → do matching/aggregation in app code.
3. **Per-transaction caps** → treat the cap as **3,000 rows / 10 MiB / 5 min** to stay safe (sources vary 3k–10k); chunk bulk seeds and **batch payouts** so a many-payee settlement never exceeds it.
4. **OCC** → mandatory **40001 retry-with-backoff** on **every** COMMIT — both the **settlement path *and* the tile-claim path** (the claim path is a real contention source; see below).
5. **Connection rate limit** → the shared-pool guardrail above, **including the simulator/coordinator script**.
6. **Telemetry = bounded UPSERT, not append log** → each heartbeat is a tiny current-state UPSERT, so DSQL absorbs the heartbeat rate and a DynamoDB hybrid stays unnecessary (write-rate budget computed in §5/§9).

### Runner-up and when to switch

| Option | Verdict |
|---|---|
| **Aurora PostgreSQL Serverless v2** *(documented fallback)* | Switch **only if** you genuinely need DB-layer FKs/triggers/views, a PG extension like **pgvector**, or transactions **>3,000 rows**. Full Postgres + RDS Data API for serverless HTTP access. **Cost:** the ~15 s scale-to-zero cold start — keep a warmer. |
| **DynamoDB** *(rejected for MVP)* | **Rejected.** Single-table design forces gymnastics for the marketplace's many-to-many job↔node relationships, and a provably-correct ledger is the most engineering-heavy path under time pressure. **Allowed later only** as a telemetry-heartbeat sink *if* measured write volume ever exceeds one DSQL cluster. |

---

## 5. Data model

All tables in **one Aurora DSQL cluster**. Integrity enforced in app code within transactions (no FKs). Ledger is append-only + derived balance on the credit side, with a per-account serialization row on the debit side. `is_simulated` is an internal column distinguishing live from simulated nodes (not surfaced as a stage badge).

```sql
users(id UUID PK, email, role ENUM['provider','requester','both'],
  reputation NUMERIC, region, kyc_status, created_at)

account_balance(account_id UUID PK,          -- SERIALIZATION POINT for debits (§4)
  available_myc NUMERIC NOT NULL,            -- conditional UPDATE on every escrow_hold
  reserved_myc  NUMERIC NOT NULL,            -- forces 40001 on concurrent overdraft
  updated_at TIMESTAMPTZ)                    -- invariant: avail+reserved == SUM(ledger)

nodes(id UUID PK, user_id UUID, display_name,
  status ENUM['online','idle','offline'],
  kind ENUM['browser','laptop','desktop','gpu'],
  capability_class TEXT,            -- e.g. 'gpu_t4_16','cpu_only'
  cpu_class, gpu_model, gpu_vram_gb, ram_gb,
  capability JSONB,                 -- {cores, gpu_model, vram_gb, vcpu}
  reliability_score NUMERIC, reputation NUMERIC,
  is_simulated BOOL NOT NULL,       -- internal: live vs simulated source
  last_heartbeat_at TIMESTAMPTZ, registered_at)

node_telemetry_current(node_id UUID PK,   -- BOUNDED UPSERT, one row/node, NOT append
  cpu_pct, gpu_pct, ram_pct, throughput_mbps,
  epoch_earnings_myc NUMERIC, payload JSONB, updated_at)

jobs(id UUID PK, requester_id UUID, name,
  type ENUM['mandelbrot','render','inference','montecarlo','sim','etl'],
  params JSONB,                     -- {width,height,center,zoom,tile_px}
  container_image_url, dataset_url,
  req_vcpu, req_gpu_model, req_ram_gb, max_runtime_s,
  total_tiles INT, completed_tiles INT, replication_factor INT,
  reward_bid_myc NUMERIC,
  status ENUM['queued','running','verifying','ready_to_settle',
              'completed','failed'],    -- 'ready_to_settle' is the settlement trigger
  result_image_uri TEXT,            -- reassembled output (S3)
  deadline_at, created_at)

tiles(id UUID PK, job_id UUID, tile_index INT,
  x0,y0,x1,y1, params JSONB,
  status ENUM['pending','claimed','dispatched','submitted','verified','failed'],
  assigned_node_id UUID NULL,
  result_uri TEXT,                  -- blob in S3 (see §5 storage); tiny tiles MAY inline
  result_hash, checksum, result_bytes INT,   -- size guard for inline-vs-S3 decision
  is_preseeded BOOL NOT NULL DEFAULT false,   -- demo: cached/'already verified' tiles
  claimed_at, dispatched_at, deadline_at, completed_at,
  UNIQUE(job_id, tile_index))       -- claim via randomized conditional UPDATE + 40001 retry

tile_results(id UUID PK, tile_id UUID, node_id UUID,
  result_hash, result_uri, submitted_at,
  vote_status ENUM['pending','agreed','dissented','challenge_pass','challenge_fail'])

ledger_entries(id UUID PK, account_id UUID, job_id UUID NULL, tile_id UUID NULL,
  amount_myc NUMERIC NOT NULL,      -- SIGNED: debit negative, credit positive
  entry_type ENUM['escrow_hold','escrow_release','provider_earn',
                  'platform_fee','refund','slash'],
  idempotency_key TEXT UNIQUE NOT NULL,   -- idempotent settlement, no replay double-spend
  created_at)                       -- credit balance = SUM(amount_myc); APPEND-ONLY

reputation_events(id UUID PK, node_id UUID,
  kind ENUM['pass','fail','sybil_flag','churn'], delta NUMERIC, created_at)

market_snapshots(id UUID PK, captured_at TIMESTAMPTZ,
  total_tflops, gpus_online, nodes_online, jobs_running, jobs_queued,
  jobs_per_sec, supply_units, demand_units,
  clearing_price_myc NUMERIC)       -- powers marketplace + telemetry charts (synthesized for demo)
```

### Result-blob storage (S3) — explicit policy

`tiles.result_uri` references blobs in S3. The policy:

- **Who writes the blob:** in the MVP, the **server-side `/submit-result` handler** writes the tile blob to S3 after the worker POSTs it, or the worker uploads via a **short-lived, tile-scoped presigned PUT URL** issued by `/pull-work`. **Untrusted workers never get broad bucket credentials** — only a single-object, time-boxed presigned URL. Roadmap (untrusted nodes) keeps this and adds server-side hash/size validation before the tile counts as `submitted`.
- **Inline-vs-S3 threshold:** tiles **≤ ~16 KB** may be inlined as base64 in `result_uri`; anything larger goes to S3 by reference. The threshold exists specifically to respect the **DSQL 10 MiB-per-transaction and per-row limits** — we never inline large base64 blobs into a settlement transaction. `result_bytes` records the size so the threshold is enforced in code.
- **Access control:** private bucket, server-issued **presigned GET** for the dashboard/telemetry to fetch tiles for reassembly preview; no public ACLs.
- **Reassembly fetch:** `/settle` (server-authoritative) reads verified tile blobs from S3 by `result_uri`, stitches them, writes the final image to S3, and stores `jobs.result_image_uri`.
- **Retention:** demo blobs are ephemeral (lifecycle-expire after the event); roadmap sets per-job retention tied to requester policy.
- **Demo simplification:** for the deep-zoom fractal hero, individual tiles are small enough to inline or to keep in a tiny demo bucket; the full lifecycle pipeline is a post-hackathon roadmap item.

### Indexes

```sql
CREATE INDEX ON tiles(job_id, status);            -- per-job progress
CREATE INDEX ON tiles(status, deadline_at);        -- scheduler straggler sweeps
CREATE INDEX ON ledger_entries(account_id);        -- credit balance = SUM per account
CREATE INDEX ON nodes(capability_class, status);   -- capability matching at claim time
CREATE INDEX ON nodes(last_heartbeat_at);          -- liveness reaping
```

### Heartbeat write-rate budget (computed, not asserted)

At **N** simulated nodes heart-beating every **T** seconds, the system generates **N/T bounded UPSERTs/sec**, all flowing through **one persistent shared pool** (a handful of long-lived connections), so the **new-connection rate is ~0** and the only variable is write throughput:

| N (sim nodes) | T (interval) | UPSERTs/sec | Posture |
|---|---|---|---|
| **50** | **3 s** | **~17/sec** | **Demo default** — comfortable headroom under DSQL write throughput and far under the 100-new-conns/sec cap (which is ~0 with pooling). |
| 100 | 3 s | ~33/sec | Acceptable, still pooled. |
| 200 | 2 s | ~100/sec | **Stretch goal, gated on a measured load test** — not assumed safe. At this rate the *write* throughput must be verified, and the new-connection rate must remain ~0, which is **only** true if the simulator uses the shared pool. |

The earlier "200 is just an option" framing is corrected: **200 nodes is a stretch goal contingent on measurement**, and **the shared-pool mandate is non-negotiable for the simulator** precisely because a per-write `new Pool()` at 200 nodes / 2 s would hit the exact 100-new-conns/sec cliff we call risk #1.

---

## 6. Frontend with v0

### Build & deploy flow

1. **Phase 0 first:** collapse the nested repo (delete the inner `/Users/sairamen/projects/Mycelia/Mycelia/.git`; canonical root = `/Users/sairamen/projects/Mycelia` — both already point at `GodlyDonuts/Mycelia`, verified with 10-byte stub READMEs).
2. Scaffold each screen as its own iteration in **v0.app**.
3. Push via v0's **Git panel** to the **one** canonical GitHub repo (prefer this over `npx shadcn add <url>` to avoid Tailwind/shadcn version drift on greenfield).
4. **Deploy to Vercel** one-click; per-PR preview deployments.
5. Connect Aurora DSQL via the **Vercel Marketplace integration** (OIDC + IAM, no static password).
6. Refactor v0 output into shared TS types, a mycelium design-token theme (deep charcoal bg, **bioluminescent teal + amber** accents), and a typed `lib/db/` data-access layer. **Treat v0 output as a scaffold to harden, not a finished app.**

The target is stable **Next.js 16** (App Router) on **React 19.2**, with **Cache Components** (the `use cache` directive / Partial Prerendering): the cached dashboard shell + reference data paint instantly, while the live render beat is a **client component that opens an `EventSource`** to a separate Fluid SSE route — replacing v0's interval placeholders.

> **Internal engineering note (Cache Components / PPR):** adopt Cache Components only from the **clean v0 scaffold** (it's a dynamic-by-default migration, not a retrofit). PPR resolves dynamic holes once on the first request; the 1 s SSE telemetry feed lives in a client component **outside** the PPR render — do **not** conflate "streaming into a `use cache` hole" with the SSE feed. **React Compiler stays OFF** (opt-in, Babel-based, raises build times); don't claim auto-memoization is on everywhere.

### How the screens call the AWS DB

Server Components / Route Handlers / Server Actions import from `lib/db/` (the single shared pooled connection via the first-party DSQL Node.js connector with cached IAM token) and run strongly-consistent reads against DSQL directly. The cached shell paints instantly via `use cache`; the live render beat is a **client component opening an `EventSource` to a separate Fluid SSE route** carrying the **1 s active-render beat (3 s idle)**, with polling as the fallback. The demo presents one unified live-looking mesh.

### Four screens for the demo (+ a fast-follow)

| # | Screen | Demo? |
|---|---|---|
| 1 | Provider / Node Dashboard | ✅ |
| 2 | Compute-Job Marketplace + Submit | ✅ |
| 3 | Live Network Telemetry **(deep-zoom fractal hero)** | ✅ |
| 4 | Landing page | ✅ |
| 5 | Settlement / Earnings Ledger | 🔜 fast follow |

### Ready-to-paste v0 prompts

**(1) Provider / Node Dashboard**
> Build a Next.js App Router dashboard page for a decentralized compute provider called Mycelia. Show a top row of stat cards: Total Earnings (in USD and MYC tokens), Active Nodes, Uptime %, and Jobs Completed Today. Below, a responsive grid of node cards, each showing node name, status badge (online/idle/offline), live CPU %, GPU %, RAM usage with progress bars, and earnings this epoch. Include a 30-day earnings area chart using a charting library. Use shadcn/ui, Tailwind, dark theme with an organic mycelium/fungal aesthetic (deep charcoal background, bioluminescent teal and amber accents). Make it responsive and accessible.

**(2) Compute-Job Marketplace + Submit Form**
> Build a Next.js App Router compute-job marketplace for Mycelia. Left: a filterable list of available jobs as cards (job name, required vCPU/GPU model/RAM, max duration, reward in MYC, deadline, requester). Right: a Submit Job form with fields for job name, container image URL, vCPU count, GPU type (select: none/T4/A10G/A100/H100), RAM (GB), max runtime, dataset URL, and reward bid; with inline validation and a cost estimate that updates live. shadcn/ui form components, Tailwind, dark mycelium theme. Server Action stub for submission.

*(Note: the submit screen also gains a natural-language "describe your job" input above the form — see the AI job-submission subsection below.)*

**(3) Live Network / Cluster Telemetry — the hero screen**
> Build a Next.js App Router live network telemetry view for Mycelia, a decentralized compute mesh. Show an animated network graph of nodes (sized by capacity, colored by load) connected like mycelium threads, with a header showing aggregate cluster stats (total TFLOPs, total GPUs online, network throughput, jobs/sec). Add a real-time line chart of cluster utilization, and a scrolling event log of node join/leave/job events. Include a panel that visualizes a deep-zoom fractal render assembling tile-by-tile into one image as tiles complete, where some tiles render as 'pre-verified' instantly and the remainder fill in live. Use shadcn/ui, Tailwind, dark bioluminescent theme, with placeholder data updating on an interval to simulate a live feed.

**(4) Landing Page**
> Build a Next.js App Router marketing landing page for Mycelia, a decentralized compute network where idle CPU/GPU/RAM is donated and rented like a living mycelium network. Hero with animated glowing mycelium-thread background, headline about turning idle hardware into a living compute organism, and dual CTAs Become a Provider / Submit a Job. Sections: how it works (3 steps: Connect, Contribute, Earn), live network stats band, provider earnings calculator (gross MYC minus local electricity = net), and a footer. shadcn/ui, Tailwind, dark organic fungal aesthetic with teal/amber bioluminescence, fully responsive and accessible.

### AI job submission — natural language → schema-valid job (screen 2)

The marketplace submit screen gains a natural-language "describe your job" input. A judge types one plain-English sentence ("render a 4K deep zoom into the seahorse valley, under two minutes, keep it cheap") and a fully-formed, schema-valid job plus a live cost estimate streams into the form — no fields touched.

- **Mechanism:** a Route Handler / Server Action calls **Claude Opus 4.8 structured outputs (constrained decoding against the jobs-row Zod schema) via the Vercel AI SDK**, streaming the preview into the form.
- **Safety:** the model output is **re-validated against the same Zod schema before it can reach `/submit`** — so the model can shape a job but a bad generation can never corrupt the ledger; the re-validated spec flows into the **unchanged `/submit` + escrow path**.
- **Resilience:** a **Claude Haiku 4.5** cost/latency fallback plus a pre-recorded replay per the resilience kit (live API latency is the only real risk in the budgeted slot).

> **Internal engineering note (NL submission):** the structured-output call uses the unified Vercel OIDC→IAM credential story; keep the mechanism at the credible-but-abstract level (constrained decoding against the Zod schema, re-validated against the same schema). Model ids are `claude-opus-4-8` (primary) and `claude-haiku-4-5` (fallback).

### What v0 does NOT generate — the hardening you own (Phase 2)

v0 produces production-grade **UI**, but **no auth, no server business logic, no ORM, no input validation, no tests**. Owned workstreams: **Auth.js/Clerk** with provider-vs-requester roles; **Zod** on every Server Action/Route Handler; **Vitest + Playwright** for UI; **the distributed/ledger test strategy below**; rate-limiting + abuse checks on the public job-submit endpoint; replace `rejectUnauthorized:false` with the RDS/DSQL CA cert; replace v0's interval placeholders with real DSQL polling/SSE.

> **"Production-ready" is scoped to the UI layer.** The hardening above is the bulk of the work and is owned as Phase 2.

### Test strategy for the distributed + ledger core (the most correctness-critical code)

UI tests (Vitest/Playwright) are necessary but not sufficient. The correctness-critical code gets its **own** test plan, owned as part of Phase 2/3:

- **Ledger invariant property/fuzz tests:** randomized interleavings of `escrow_hold` / `escrow_release` / `provider_earn` / `slash` / `refund` must always satisfy (1) no account's effective balance goes negative, and (2) `available_myc + reserved_myc == SUM(signed ledger entries)` per account after every committed transaction.
- **Concurrent-overdraft test:** spawn K concurrent `/submit` calls against an account that can fund only one; assert exactly one succeeds and the rest fail the funds check via 40001-retry — proving the per-account serialization row works.
- **Idempotency test:** re-run the same settlement (same `idempotency_key`) M times concurrently; assert exactly one set of ledger rows lands and the balance is credited once.
- **40001-retry correctness:** inject synthetic OCC aborts on both the settlement path and the **tile-claim path**; assert eventual success and no duplicate effects.
- **Claim/verify state-machine tests:** model `tiles.status` transitions; assert no tile is double-claimed, no tile settles without being `verified`, and `/settle` is rejected unless **all** tiles are verified (server-authoritative re-check).
- **Reconciliation sweep:** a periodic job recomputes `SUM(ledger)` per account and asserts it equals the `account_balance` row, flagging any drift.

---

## 7. Contributor incentives / credit economy

Designed around **marginal economics, not headline rates** — GPU hosting only pencils out comfortably **below ~$0.15/kWh**; at $0.30+/kWh only the newest high-VRAM cards clear margin.

- **Escrow-until-verified loop** (the ledger's organizing principle): requester funds `escrow_hold` at submit (through the serialization point) → `escrow_release` + `provider_earn` + `platform_fee` on verified reassembly → `refund` of unused escrow. Cheaters are `slash`ed.
- **Pay per VERIFIED tile, not per claimed FLOP.** When redundant results agree, credit the *smaller* claimed work (BOINC's anti-inflation rule).
- **Region-aware, marginal-economics-aware payouts:** surface estimated **NET earnings = gross MYC − local electricity**. Let providers cap power/temperature (the **80–90% power-limit trick**) and schedule around cheap/off-peak/renewable windows. No "free money" overpromise.
- **Quality/reputation-weighted, not raw-FLOPS:** reliable nodes graduate to adaptive replication and earn more per unit (Bittensor-style quality weighting + Vast.ai reliability bonuses).
- **MVP:** MYC ticks up purely on **real tile/job completion**. **Redemption is cut** to dodge tax/KYC/securities complexity during the hackathon.
- **Token path:** MYC launches as an **internal stable-value credit**, redeemable later to cash/gift-cards/crypto (Salad-style on-ramp). We deliberately avoid a speculative tradeable token at launch (securities scrutiny, volatility, Sybil-magnet) while keeping the option open — and we disclose the tax/KYC/AML tradeoff.

### Unit economics — the worked break-even (the existential question, quantified)

The business closes only if **contributor payout beats marginal electricity** *and* **requester price beats consumer-GPU-cloud spot**, *after* the verification tax and platform fee. Here is a representative worked example for one **RTX 4070-class node** (illustrative figures, to be replaced with measured numbers in Phase 5; the point is the *method and the regimes*, not three-decimal precision):

**Assumptions**
- Node draws **~+200 W** incremental at load; one node-hour ≈ **0.20 kWh**.
- Useful **sellable** compute after verification: with **2× replication for unproven nodes**, only **~50%** of harvested work is sellable; once a node earns reputation and moves to ~**1.1×** spot-checking, **~90%** is sellable. We model **both ends**.
- **Platform fee: 20%** of requester spend.
- Reference demand-side price: consumer-GPU-cloud spot for a 4070-class card runs on the order of **~$0.10–0.20 / GPU-hour** (Salad/Vast range); call the requester price **$0.15 / sellable GPU-hour** to undercut hyperscaler on-demand meaningfully.

**Per node-hour, the spread:**

| Item | Low-kWh regime ($0.12/kWh) | High-kWh regime ($0.30/kWh) |
|---|---|---|
| Contributor electricity cost (0.20 kWh) | **$0.024** | **$0.060** |
| Requester gross @ $0.15 × sellable fraction (use 0.5 unproven / 0.9 proven) | $0.075 / **$0.135** | $0.075 / **$0.135** |
| Platform fee (20% of gross) | $0.015 / $0.027 | $0.015 / $0.027 |
| Contributor receives (gross − fee) | $0.060 / **$0.108** | $0.060 / **$0.108** |
| **Contributor NET (receives − electricity)** | **+$0.036 / +$0.084** | **+$0.000 / +$0.048** |

**Read-out of the regimes:**
- **Positive spread (the wedge):** low-electricity regions ($0.12/kWh) with a **reputation-graduated GPU node** clear a healthy positive net (**~+$0.08/node-hour to the contributor** after the platform takes its fee, with the requester still paying below hyperscaler on-demand). This is the beachhead: GPU contributors in cheap-power regions, on proven nodes, at high sellable fraction.
- **Marginal / negative spread:** at **$0.30/kWh** an **unproven** node (50% sellable) nets **~$0.00** — the contributor barely breaks even, which is why **only reputation-graduated, high-VRAM nodes in moderate-to-cheap power regions are the supply we actively recruit**, and why the verification tax is the single biggest lever on the whole business.
- **CPU-only harvesting:** likely **never** beats cloud spot CPU and is **not a target supply class**; we recruit it only for tasks where data-egress or licensing makes consumer CPU uniquely cheap.

**Conclusion the judges can check:** the spread is positive in the GPU + cheap-power + proven-node regime and goes to zero/negative in high-kWh or unproven-node regimes. That is precisely why Mycelia is a **trust-and-economics company**: every dollar of moat comes from **driving the sellable fraction up** (better verification → less replication tax) and **routing supply toward favorable power regimes** (region-aware payouts). The verification-tax line is not a footnote — it is the business.

---

## 8. Security, trust & abuse

Two trust directions, plus credentials and ledger integrity.

| Area | Status | Approach |
|---|---|---|
| **Host protection** (job → device) | **Roadmap (Phase 4)** | Design: every untrusted job runs in a **WASM/WASI sandbox via Wasmtime**, capability-denied-by-default (no FS/network/OS ambient authority), microsecond start, AOT within ~10% of native. GPU/native jobs → **Firecracker microVM / gVisor**, never raw binaries. Idle-only, hard CPU/GPU/thermal/power caps, instant yield. MVP runs **only our own trusted deep-zoom fractal kernel**, so this is out of MVP scope. |
| **Result verification** (untrusted node → correct result) | **Roadmap (Phase 5) — the core differentiator** | This is the company's moat. Design: stake-weighted **Proof-of-Sampling (PoSP)** + **refereed-delegation recompute** (Gensyn Verde / RepOps fixed-order-kernel lineage). A referee **binary-searches the compute graph to the first divergent op and recomputes only that** — so verification cost goes from 2× replication **toward logarithmic**. Stake-weighted spot-checking makes cheating **negative-EV for rational actors**, with a **trusted-recompute backstop** for high-value jobs and collusion. **The hard sub-problem:** cross-architecture GPU **floating-point nondeterminism** makes *bitwise* result-voting infeasible for many real GPU workloads, addressed per workload class (see cost model below) via **homogeneous-redundancy classes** (verify only across identical hardware — which *fragments the supply pool*) or **trusted-node recompute spot checks** (which *caps the savings*). zk-proven deterministic jobs via **Succinct SP1** reserved for narrow high-value jobs (moonshot). |
| **Verification cost model** | — | **2–3× replication for new/unproven nodes ⇒ 33–50% sellable throughput**, dropping toward **~1.05–1.1×** (≈90% sellable) once PoSP + refereed recompute drives verification cost toward logarithmic. The sellable fraction is the dominant term in the unit economics (§7). Bitwise voting works only for deterministic/integer workloads (e.g., our deep-zoom fractal kernel with fixed precision); for FP-heavy GPU workloads (batched inference, Monte Carlo) we use homogeneous-redundancy **or** trusted-node recompute. |
| **Job-data confidentiality** (host → data) | **Roadmap** | Consumer hardware has **no usable TEE** (SGX deprecating — Azure retiring SGX VMs by June 2026; SEV-SNP/TDX are server-only; FHE too slow). We **assume the host can read job code + data.** **v1 = public / non-sensitive data only** (public scenes, public-model inference, open datasets, public scraping), sharded/obfuscated so no single node sees a coherent slice. Confidential workloads are explicitly out of scope. |
| **Sybil defense** | Engineered up front | Majority voting alone is Sybil-vulnerable. **Stake-at-risk + identity cost + reputation** (SybilGuard/SybilLimit lineage) so a banned identity forfeits accrued credit. |
| **Abuse / legal / ToS** | Operational cost (framework in §13-adjacent and below) | Job vetting + content/abuse policy + rate-limiting the public submit endpoint + IP/legal review to stop crypto-mining, password cracking, or attacking third parties from thousands of residential IPs. |
| **Credentials** | Zero static secrets | Vercel Marketplace AWS integration → **OIDC + DSQL 15-min IAM tokens**; secrets in Vercel env vars; IAM role least-privilege to the **specific** DSQL cluster; no AWS SDK/SQL in client components; token cached/refreshed under the 100-conns/sec limit; **simulator/coordinator script uses the same shared pool**. Workers receive only **single-object, time-boxed presigned S3 URLs**, never bucket credentials. |
| **Ledger integrity** | Provably correct (replay + overdraft) | Debit + credit in **one DSQL transaction** with **40001 retry-with-backoff**; **append-only credit balance + per-account serialization row for debits + `UNIQUE idempotency_key`**; in-transaction referential integrity (no FKs). See §4 for the overdraft proof. |
| **Tile-claim concurrency** | Engineered | Workers claim via a **randomized** conditional `UPDATE WHERE status='pending' ORDER BY random() LIMIT 1` with **mandatory 40001 retry-with-backoff on the claim path** (not just settlement). The simulator **self-partitions tile ranges** so its 50 nodes never contend; the N≥3 real workers exercise genuine OCC claim contention. |
| **Sustainability** | First-class | We surface NET earnings and are transparent that profitability depends on local electricity; the core claim is **no new buildout** — no new land, datacenter construction, water-cooling plant, or grid interconnect. |

> The MVP runs a deterministic deep-zoom fractal kernel (a WGSL compute kernel) — embarrassingly parallel and trivially self-verifiable, and the determinism is exactly what the ledger + verification + self-check story depends on — so it proves the data path, ledger, and fan-out plumbing without exercising sandboxing or untrusted-result verification yet. The hard target workloads (batched LLM inference, rendering, Monte Carlo) and their verification and data-confidentiality problems are the roadmap and the real moat.

> **Internal engineering note (split the two claims — do not fuse).** State these separately: **(1) Ledger** — *provably safe against overdraft and replay* (earned, via the per-account serialization row + `UNIQUE idempotency_key`, §4). **(2) Verification** — a stake-weighted spot-check that makes cheating *negative-EV for rational actors* with a *trusted-recompute backstop* for high-value jobs and collusion (Phase-5 design, **not** a demo claim). PoSP's Nash guarantee holds only for rational actors with tuned slashing and weakens under cohort collusion — never fuse it under one "provably safe" banner or use bare "mathematically -EV."

### Abuse / legal framework (more than a one-liner)

Running arbitrary compute on thousands of residential IPs is a real legal surface. The framework, owned starting Phase 2 and hardened by Phase 5:

- **Allowed-workload allowlist (not denylist):** at launch, only first-party/vetted job *types* (rendering, public-model batched inference, open-data sims, public scraping within target-site ToS). Arbitrary container images are gated behind manual review until automated vetting exists.
- **Explicitly disallowed:** crypto-mining, password/hash cracking, port-scanning or any traffic that targets third parties, anything touching CSAM or illegal content, and workloads that would violate the residential ISP's ToS.
- **Export control / sanctions:** geofence sanctioned regions for both contributors and requesters; KYC on the requester (paying) side before real-money flows.
- **Contributor consent & age:** explicit opt-in consent flow, minimum age, clear disclosure of what runs on their hardware and what telemetry is collected.
- **Contributor telemetry privacy stance:** we collect only operational telemetry (utilization, throughput, earnings) in the bounded `node_telemetry_current` row; no browsing or personal data; documented retention and the right to delete.

---

## 9. MVP scope & the hero demo

### Six must-haves (build for real)

1. v0 Next.js dashboard on Vercel reading live from **one Aurora DSQL** cluster — **shown in the first minute** (the requirement gate), against a **kept-warm** cluster.
2. **N≥3 real workers** computing genuine deep-zoom fractal tiles (teammate laptops + phone browser tabs), not just one — so the genuine-distribution claim is N>2.
3. A browser-tab worker behind a **"Join the mesh"** button — a live node appears in **~2 s**. On the **pre-warmed Chromium stage machine** this is a **WGSL compute kernel on WebGPU** with a live per-dispatch GPU timestamp; every other device feature-detects and falls back to a **TS-on-CPU Web Worker**.
4. **One deep-zoom fractal render job** (WGSL compute kernel, high iteration depth so it genuinely saturates the GPU and takes visible wall-clock) that fans out into tiles across real + simulated nodes and **reassembles into one image** on the telemetry screen, with **~70% of tiles pre-seeded as cached/already-verified** so the image is mostly-formed instantly and visibly completes the live ~30% within one or two poll cycles. The deep-zoom fractal stays **deterministic and self-verifiable**, so the self-check property holds.
5. A **MYC credits ledger** that increments on **REAL** tile/job completion (append-only `ledger_entries`, debits through the serialization row).
6. A minimal **supply-vs-demand marketplace** view (from `market_snapshots`).

**Supporting (real but lightweight):** the stateless coordinator endpoints (`/submit`, `/pull-work`, `/submit-result`, `/settle`) + the **local driver/simulator script** (50 simulated nodes, self-partitioned tile ranges, heartbeat UPSERT @ T=3 s through the shared pool).

### Build note (internal — what's wired live vs. simulated)

For the build team's scoping. The live-wired pieces are the DSQL read path, the ledger on real completions, the browser worker, and the N≥3 real machines; the rest of the mesh is simulated for scale and presented as one unified network.

| Live-wired | Simulated for scale |
|---|---|
| v0 dashboard, live DSQL reads | Background fleet of ~47–50 nodes (driver/simulator) |
| **N≥3 workers** (real tiles) | "Datacenter-scale" aggregate TFLOPs |
| Browser "Join the mesh" worker (WGSL/WebGPU on stage; CPU fallback) | 30-day history |
| The live ~30% of the deep-zoom fractal fan-out + the real reassembly + settlement | The price/spot curve and the pre-seeded ~70% of tiles (cached/pre-verified) |
| The credits ledger on real completion | The world map |

Internal: genuine distributed execution is demonstrated at N≥3 real machines, with the remaining fleet simulated for scale.

### The hero job

A **deep-zoom fractal tile render (WGSL compute kernel)** — output is an **image, never a number**. The render is a high-resolution, high-iteration-depth deep zoom (Mandelbrot/Julia) that genuinely **saturates the GPU and takes visible wall-clock**, with the per-dispatch GPU timestamp shown live so WebGPU is showing real muscle, not microseconds. Tiles light up across the mesh and visibly reassemble, so fan-out and reassembly are *seen*, not described. It remains a **deterministic, self-verifiable** workload chosen to prove the plumbing end-to-end — the determinism the ledger and self-check depend on still holds.

### Resilience kit (apply verbatim)

- **Keep-alive ping every ~4 min** for the whole demo session (not a one-shot pre-warm) so DSQL never re-sleeps; **pre-seed** tables ~30 s before so the first read returns rows.
- **Pre-seed ~70% of tiles as cached/already-verified**; keep a **seeded replay path** for the remainder.
- **AI beat:** **Claude Haiku 4.5 fallback** for NL job submission + a **pre-recorded replay** if live API latency blows the budgeted slot.
- **WebGPU beat:** **TS-on-CPU Web Worker fallback** if the stage machine's WebGPU path misbehaves; the deep-zoom fractal still renders, just on CPU.
- **Test on a hotspot** beforehand (conference Wi-Fi may block real-node POSTs).
- The **simulated fleet + cached/pre-seeded tiles finish the render** even if every real worker dies — never depend on a single real worker; with N≥3 real workers, lose-one is graceful.

### Observability & failure-mode runbook (on-stage, with owners)

We can't fix what we can't see on stage. A lightweight observability panel + a decision tree:

- **On-stage health strip (a tiny admin view):** live counters for (1) tiles by status, (2) DSQL error rate including any `53400`/`40001` spikes, (3) last-heartbeat age per real worker, (4) settlement status. If tiles stall or an error counter spikes, we *see* it immediately rather than guessing.
- **Decision tree (owner in parentheses):**
  - *DSQL slow/cold on first read (DB owner):* keep-alive should prevent it; if it still stalls >X s, the dashboard shows pre-seeded rows already, so narrate and continue.
  - *Real-node POSTs blocked by venue Wi-Fi (demo driver):* switch to phone-hotspot (tested beforehand); the simulated fleet + cached tiles complete the render regardless.
  - *Claim/40001 storm makes tiles look stuck (coordinator owner):* retry is built in; if the health strip shows persistent aborts, fail over to the **seeded replay path**.
  - *Any two of the above, or we pass minute N of the slot (presenter):* **switch to the pre-recorded replay** at a pre-agreed cut point — explicit go/no-go, decided live by the presenter.

### Demo acceptance criteria (measurable gates — "it works" is not subjective)

The demo **passes** iff all of the following hold:

1. First **live DSQL read renders in < 3 s** on stage (against the kept-warm cluster).
2. The **browser "Join the mesh" node appears in < 2 s** after click; on the stage machine the **WebGPU WGSL kernel runs with a live per-dispatch GPU timestamp** (CPU fallback otherwise).
3. The **NL job-submission input** turns one plain-English sentence into a **schema-valid job + live cost estimate** streamed into the form via Claude Opus 4.8 (Haiku 4.5 / replay fallback).
4. The **deep-zoom fractal image fully reassembles in < 15 s** from job submit (≤ ~2 active poll cycles for the live ~30%, the rest pre-seeded), and **at least 3 real tiles** are computed by real workers and pass the deterministic self-check (genuine distribution, N≥3).
5. The **MYC ledger increments by exactly the verified-tile reward** for each real verified tile (and the on-stage health strip shows zero unhandled DSQL errors).
6. The **network view shows a populated, healthy mesh** (dozens of active nodes) with smooth live updates and no visual stalls.

### Demo beat sheet (~3.5 min, with a time budget on the hero beat)

1. **Hook (~20 s)** — idle CPUs + the datacenter power/water/GPU crisis.
2. **(~30 s)** Show the v0 origin + a live Aurora DSQL read in the first minute (satisfy the gate; cluster already kept-warm; passwordless OIDC→IAM, zero stored credentials).
3. **(~30 s, NL submission — strong early beat)** A judge types **one plain-English sentence** ("render a 4K deep zoom into the seahorse valley, under two minutes, keep it cheap") and a **schema-valid job + a live cost estimate stream into the form** — no fields touched (Claude Opus 4.8 structured outputs, re-validated against the same Zod schema that guards `/submit`).
4. **(~25 s)** Click **"Join the mesh"** → a real browser node appears in ~2 s; on the stage Chromium machine a **WGSL compute kernel saturates the GPU**, with the **live per-dispatch GPU timestamp** on screen — real GPU muscle, zero install.
5. **(~30 s, budgeted)** The **deep-zoom fractal job** fans out → ~70% pre-verified tiles appear instantly, the live ~30% fill in across real + simulated nodes over SSE within one or two 1 s beats, and the image **reassembles** (< 15 s gate).
6. **(~15 s)** **Credits tick up** on real completion; point at the ledger increment.
7. **(~15 s)** Show **marketplace supply vs demand**, and point Claude at the **read-only MCP endpoint** so an agent reads the live mesh and explains a settlement.
8. **Close (~40 s):** the vision — every idle device becomes part of a living compute organism; the crisis it addresses; what's live today (NL submission via Claude Opus 4.8, real WebGPU compute on stage, passwordless DSQL marketplace, real ledger, real distributed render, MCP-exposed mesh); and the roadmap to global scale, native GPU clients, and the named verification moat (PoSP + refereed-delegation recompute) that is the long-term lever.

---

## 10. Build roadmap

**Critical path:** Phase 0 repo hygiene → live DSQL read on Vercel (kept-warm) → stateless coordinator `/submit` + `/pull-work` (randomized claim + 40001 retry) + `/submit-result` → deep-zoom fractal reassembly via `/settle` → ledger increment through the serialization row. *Everything else is parallelizable or cuttable.*

| Phase | Scope | Notes |
|---|---|---|
| **Phase 0 — Repo hygiene + paved path** *(day 1)* | Collapse the nested repo (delete inner `/Users/sairamen/projects/Mycelia/Mycelia/.git`, canonical root `/Users/sairamen/projects/Mycelia`); scaffold all four screens in v0; push via Git panel; deploy to Vercel; provision Aurora DSQL via the Marketplace integration; stand up `lib/db/` with **shared pool + cached IAM token + `attachDatabasePool`**; **measure and record the scale-to-zero resume latency**; verify a live read end-to-end. | Must happen **before** any v0 Git push lands. |
| **Phase 1 — Hackathon MVP** | The six must-haves: **stateless** coordinator endpoints, N≥3 real workers + browser worker (WebGPU on stage / CPU fallback), local driver/simulator (50 simulated, self-partitioned, shared pool), deep-zoom fractal reassembly via server-authoritative `/settle`, MYC ledger (overdraft-safe) on real completion, marketplace view, polling dashboard (1 s active / 3 s idle), full resilience kit + on-stage health strip + acceptance gates. | The deliverable. |
| **Phase 2 — Harden the frontend + correctness core** | Auth.js/Clerk roles, Zod everywhere, Vitest + Playwright (UI), **ledger/state-machine property+fuzz tests + reconciliation sweep**, rate-limiting + abuse allowlist on job-submit, RDS/DSQL CA cert validation, the abuse/legal/privacy framework, **real-money overdraft path** (graduate from pre-funded internal accounts). Build the **Settlement/Earnings Ledger** screen (fast follow). | "Production-ready" = this. |
| **Phase 3 — Real async backend** | Move orchestration off Vercel onto the dedicated AWS backend: API Gateway + Lambda (intake/pull/heartbeat/result), Fargate scheduler (timeout retries + speculative execution + straggler kill), SQS + EventBridge (dispatch + DLQ + settlement events), Fargate verification worker, settlement worker writing the DSQL ledger with 40001 retry. **Vercel Workflows (GA)** is the durable settlement-saga option. Keep `lib/db/` abstracted (swappable to OpenNext-on-AWS). | The "graduate the stub" phase — note the stub was *already* request-driven, so this is additive, not a rewrite. |
| **Phase 4 — Real untrusted workloads + native client** | WASM/WASI sandbox via Wasmtime; ship the **native Rust daemon** (wgpu, idle detection, hard power/thermal caps) as the real supply engine; WebGPU browser path (Chromium-only; quantify Safari gap); Firecracker/gVisor for native-binary GPU jobs; begin work toward the "one artifact, two clients" goal (acknowledged non-trivial). | |
| **Phase 5 — Trust + economics layer (the real company)** | **Build the verification stack: stake-weighted Proof-of-Sampling (PoSP) + refereed-delegation recompute** (Gensyn Verde / RepOps lineage — a referee binary-searches the compute graph to the first divergent op and recomputes only that, driving verification cost from 2× toward logarithmic), plus **zk-proven deterministic jobs via Succinct SP1** for narrow high-value jobs; homogeneous-redundancy classes vs trusted-node recompute chosen per workload; the FP-nondeterminism handling; staking + slashing; Vast.ai-style reliability scores + Render-style tiers; SLA tiering; region-aware payouts + power caps + off-peak scheduling; MYC redemption with the tax/KYC tradeoff chosen deliberately; replace illustrative unit-economics with measured numbers. | The verification moat — drives the sellable fraction (§7) from ~50% toward ~90%. |
| **Phase 6 — Scale + ambitious workloads** | Batched AI inference + 3D/video rendering as first paying workloads; **multi-region active-active Aurora DSQL** (no failover — single-region is the MVP default; size the heartbeat/claim round-trip budget for globally-distributed real nodes first); **DiLoCo-class / Decoupled-DiLoCo** low-communication decentralized training as a build-on (cited as a tailwind, **not** a from-scratch claim — INTELLECT-3 was trained centralized). | Multi-region is roadmap, never an MVP claim. |

---

## 11. Tech stack summary

| Layer | Technology |
|---|---|
| **Frontend scaffold** | Vercel **v0** → **Next.js 16** (App Router, **Cache Components / PPR**), **React 19.2**, Tailwind, shadcn/ui. React Compiler off (opt-in). |
| **Hosting / read path** | **Vercel Fluid Compute** (Server Components, Route Handlers, Server Actions); **SSE on Fluid Compute** for the live render beat + `after()` for post-response writes; polling (1 s active / 3 s idle) fallback; **no long-running process / no self-hosted WebSockets** |
| **Database** | **Amazon Aurora DSQL** (single strongly-consistent cluster, scale-to-zero; JSONB for manifest storage). Multi-region active-active = Phase 6. Fallback: Aurora PostgreSQL Serverless v2. DynamoDB rejected for MVP. |
| **DB connection** | First-party **AWS DSQL Node.js connector** (Feb 2026) + `attachDatabasePool` (`@vercel/functions`); one shared pool, cached IAM token — **mandate extends to the simulator/coordinator script** |
| **Auth (DB)** | Vercel Marketplace AWS integration → **OIDC → AWS IAM** federation + DSQL 15-min IAM tokens (no static password) |
| **AI — job submission** | **Claude Opus 4.8** (`claude-opus-4-8`) structured outputs via **AI SDK 6**; Zod re-validation before `/submit`; **Haiku 4.5** fallback + pre-recorded replay |
| **AI — agentic surface** | **MCP server** (read-only) via Vercel `mcp-handler` (Streamable HTTP), `@modelcontextprotocol/sdk >= 1.26.0`; `/settle` is **not** an MCP-authorizable tool |
| **Coordinator (MVP)** | **Stateless** Route Handlers (`/submit`, `/pull-work`, `/submit-result`, `/settle`) + a **local driver/simulator script** (the only long-lived process) |
| **Result blobs** | S3 (private bucket, server-issued presigned PUT/GET, tile-scoped); tiles ≤ ~16 KB may inline as base64 |
| **Control plane (roadmap)** | API Gateway + Lambda + SQS/EventBridge + ECS/Fargate scheduler & verification/settlement workers; **Vercel Workflows (GA)** as the durable-settlement-saga citation |
| **Demo worker** | Browser **WebGPU** (WGSL compute kernel) on the pre-warmed Chromium stage machine; **TS-on-CPU Web Worker fallback** everywhere else |
| **Roadmap worker** | Native **Rust daemon** (Tauri/raw-Rust, `wgpu`, launchd/systemd/Windows SCM) — the real supply engine |
| **Job sandbox (roadmap)** | **Wasmtime** (WASM/WASI, capability-denied-by-default); Firecracker/gVisor fallback |
| **Verification (roadmap)** | **Proof-of-Sampling + refereed-delegation recompute** (Gensyn Verde / RepOps lineage); zk-proven deterministic jobs via **SP1** for narrow high-value jobs |
| **App auth (Phase 2)** | Auth.js or Clerk (provider/requester roles) |
| **Validation / tests (Phase 2)** | Zod on every Server Action/Route Handler; Vitest + Playwright (UI); property/fuzz tests for ledger invariants + claim/verify state machine |
| **Hero workload** | deep-zoom fractal (WGSL compute kernel), deterministic + self-verifiable, GPU-saturating; output = image |

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Vercel cannot host a long-running coordinator (was a self-contradiction)** — Route Handlers/Server Actions cap at ~10–60 s and hold no state between requests. | Coordinator is **fully request-driven and stateless**; all scheduler state lives in DSQL; any timing/looping lives in the **local driver/simulator script** on the demo laptop. No server-side loop anywhere in Tier 1. |
| **Connection storm (engineering priority #1)** — a per-request `new Pool()` hits DSQL's 100-new-conns/sec limit and silently breaks the demo. | **ONE** shared pooled connection in `lib/db/`, cached/refreshed IAM token, connection reused, `attachDatabasePool` — **and the same mandate applies to the simulator/coordinator script**, where the demo-killer would otherwise live. |
| **Simulator write volume vs the 100-conns/sec cliff** — 200 nodes / 2 s ≈ 100 writes/sec from quick-hack code. | Shared pool ⇒ new-connection rate ~0; write rate is the only variable. **Demo default N=50, T=3 s (~17/sec)**; 200 nodes is a **measured stretch goal**, not assumed safe. |
| **Concurrent escrow overdraft under OCC + derived balance** — two submits both pass the funds check and both commit (no shared row to conflict on). | **Per-account `account_balance` serialization row**: every `escrow_hold` conditionally UPDATEs it in-transaction, so concurrent debits collide and one aborts with 40001. Hot-row contention accepted **only on the low-frequency debit path**. MVP uses pre-funded internal accounts; real-money path is a Phase 2/5 item. |
| **Tile-claim 40001 storm** — many workers race the same `pending` tile under OCC; retry was only mandated for the ledger. | **40001 retry-with-backoff extended to the claim path**; claim a **randomized** tile (`ORDER BY random() LIMIT 1`); simulator **self-partitions** so only the N≥3 real workers exercise real contention (stated, not over-claimed). |
| **Settlement/reassembly trigger had no owner in the stub** | `/submit-result` writes a `ready_to_settle` marker on the final tile; a **separate server-authoritative `/settle`** re-verifies all-tiles-verified, reassembles, and pays — **chunked under the 3,000-row cap**. An untrusted client may *detect* completion but is **never** the payment authority. |
| **Cold/empty dashboard on stage; "no cold start" claim was unmeasured** | **Keep-alive ping every ~4 min** all session (not one-shot); **measure and publish** the actual resume latency; pre-seed rows. Drop the "no meaningful cold start" wording. |
| **Conference Wi-Fi blocks real-node POSTs** | Test on a hotspot beforehand; cached/pre-seeded tiles + simulated fleet finish the render; recorded replay fallback at a pre-agreed cut. |
| **Single real node as a point of failure** | **N≥3 real workers** + simulated fleet + cached tiles complete the deep-zoom fractal render independently. |
| **v0 generates UI only (no auth/logic/validation/tests)** | Scope "production-ready" to the UI layer explicitly; own hardening + the **distributed/ledger test strategy** as Phase 2. |
| **Untrusted-result verification is unsolved industry-wide** | Verification cost model (33–50% sellable under replication, → ~90% proven) + the named **PoSP + refereed-delegation recompute** design and its FP-nondeterminism fallbacks (homogeneous-redundancy / trusted-node recompute), built as a Phase 5 item. |
| **Cross-architecture GPU FP nondeterminism** — bitwise voting infeasible for many GPU workloads. | Per-workload choice: **homogeneous-redundancy classes** (fragments supply) **or** trusted-node recompute spot-checks (caps savings). |
| **Simulated fleet must look seamless** | Realistic telemetry curves + join/leave events + self-partitioned tile ranges so the mesh reads as one live network. |
| **Browser client does ~no work when backgrounded** — tab throttling clamps timers/pauses rAF. | Browser = **onboarding/demo funnel, not supply engine**; the **native daemon is the supply engine**. The on-stage WGSL/WebGPU kernel is the showcase on hardware we control, not a per-tab claim. *(Internal: multi-threaded WASM would need COOP/COEP cross-origin isolation — but the WebGPU compute path does not, so we do not set those headers.)* |
| **WebGPU degrades silently on uncontrolled hardware** — Safari pre-26, Firefox on Intel-Mac/Linux, backgrounded-tab throttling. | Run WebGPU **only on the pre-warmed Chromium stage machine**; every other device **feature-detects → TS-on-CPU Web Worker fallback** so the deep-zoom fractal still renders. |
| **OCC commit aborts (40001)** | Mandatory retry-with-backoff on **every** ledger COMMIT **and** every tile-claim COMMIT. |
| **Per-transaction caps** | Treat as 3k rows / 10 MiB / 5 min; chunk bulk seeds and **batch payouts**; never inline large base64 tile blobs into a settlement transaction. |
| **Non-visual hero job** | Deep-zoom fractal image, never a number. |
| **Easiest-possible hero workload implies the hard problems are close** | State explicitly that the deep-zoom fractal proves **plumbing** (and real GPU work), not the moat; the hard workloads (inference/render/Monte Carlo) and their verification/confidentiality problems are the real, unbuilt work. |
| **Cost surprise** — $100 AWS credit lasts only 6 months. | DSQL scale-to-zero + free tier; model the bill before any non-demo launch. |
| **Economics may kill the real business** — verification halves sellable throughput; at >$0.30/kWh volunteers barely break even; CPU-only may never beat cloud spot CPU. | **Worked unit-economics example (§7)** names the positive regime (GPU + cheap power + proven node) and the negative regimes; region-aware payouts, power caps, and driving the sellable fraction up are the levers. This is a trust-and-economics company. |
| **Job-data confidentiality unsolved on consumer HW** | v1 = public/non-sensitive data only; explicitly out of scope. |
| **Node churn / straggler long tail** | Speculative execution + aggressive timeouts (roadmap control plane). Tail latency, not average throughput, is the customer pain. |
| **Legal/regulatory surface** — arbitrary compute on residential IPs. | **Allowlist of vetted workloads**, explicit disallow list, geofence sanctions, requester KYC, contributor consent/age, telemetry privacy stance (§8). |
| **Vendor coupling** (OIDC/RDS-IAM, `@vercel/functions`) | Keep `lib/db/` abstracted so the connection mechanism can be swapped (e.g., OpenNext-on-AWS). |
| **Single-region coordinator vs global nodes** | Fine for batch; **size the heartbeat/claim round-trip budget** for globally-distributed real nodes before any multi-region move. |
| **Nested-repo confusion** | Resolved in Phase 0 — re-verified both point at `GodlyDonuts/Mycelia` with 10-byte stub READMEs; delete the inner `.git`. |

---

## 13. Differentiation

**Position against Salad** — the true competitor (450k+ consumer gaming PCs, 60k+ daily-active GPUs, gamified rewards) — **not BOINC or Akash.** Salad already solved consumer onboarding UX; we must match or beat it. (Salad's GPU floor is ~8 GB VRAM; we cite it as ~8 GB.)

**The 2026 frontier** (Gensyn, Hyperbolic, Prime Intellect, io.net) has converged on two things: **a named verification primitive** and **decentralized-training resilience**. Mycelia's refreshed stack matches the frontier on both vocabulary and architecture, then claims the one wedge none of them holds — applying that verification engine to the TEE-less consumer household long tail.

| vs. | Their model | Mycelia's edge |
|---|---|---|
| **BOINC / Folding@home** | Non-monetary credits; redundancy + voting. Proved feasibility at million-node scale but never mobilized self-interested supply. | **Real, marginal-economics-aware MYC payouts** + a named verification stack (**PoSP + refereed-delegation recompute**) that supersedes naive redundancy and is tuned per workload class. |
| **Gensyn** (Verde, refereed delegation, mainnet 2026) | Op-level dispute resolution over a verifier-pool model. | We adopt the *same* **refereed-delegation + PoSP** primitive — so we are **not behind on verification theory** — but apply it to the **TEE-less consumer household long tail** Gensyn's verifier-pool model isn't designed for. Verde proves the engine is real; we cite it, not compete on theory. |
| **GPU-TEE / confidential-compute camp** | Hardware-attested "verifiable AI from strangers." | Consumer GeForce silicon has **no TEE**, so hardware attestation is flatly impossible on our supply — which is exactly why a **software** verification primitive (PoSP + recompute) is the *only* credible path for the consumer long tail, and why it sharpens rather than weakens the story. |
| **Salad** | Native app, auto-matching, gift-card-only rewards, ~8 GB-VRAM GPU floor, **no named verification**. | **No-new-buildout sustainability narrative** (uncontested); **broader device reach** via zero-install browser onboarding funnel past the GPU floor (native daemon is the real supply engine); **transparent net-earnings** + cash/stablecoin path beyond gift-cards; and the thing they lack — a **named, math-backed verification cost model** that is the entire unit-economics lever. |
| **Akash** | Reverse-auction decentralized cloud; skews to datacenter/provider hardware. | Genuine **consumer-device** supply + the reuse-already-built-hardware story Akash can't tell credibly. |
| **io.net** | Aggregates 100k+ GPUs — but quietly from datacenters/miners, not households. | **Consumer-node focus** + reliability orchestration as a first-class product feature. |
| **Render** | Distributed GPU rendering, escrow-until-validated, Proof-of-Render. | We adopt **escrow-until-verified** as our ledger's organizing principle and generalize it beyond rendering to inference/sims/ETL. |

**Defensible edges:** (1) the **no-new-buildout sustainability narrative** no incumbent owns cleanly; (2) **broader device reach** via a zero-install browser onboarding funnel; (3) **reliability + transparent economics** plus a **named, math-backed verification primitive** (PoSP + refereed-delegation recompute) as a product feature; (4) the **agentic / DX layer** — NL job submission and an MCP-exposed mesh — a 2026 freshness signal incumbents don't surface, making Mycelia legible to the agent ecosystem the rest of the field still treats as out of scope. The beachhead is latency-tolerant batch on **GPU + cheap-power + proven** supply (frontier LLM pretraining and low-latency serving are not the target), with DiLoCo-class training cited as a maturing tailwind, not a launch claim.

**One-line edge:** *Mycelia is the first consumer-household compute network with a named, math-backed verification primitive — applying the 2026 frontier's own verification engine to the TEE-less long tail nobody else can verify, on hardware that needs no new datacenter.*

---

## 14. Open questions / decisions for the user

1. **Repo collapse confirmation** — OK to delete the inner `/Users/sairamen/projects/Mycelia/Mycelia/.git` and its 10-byte stub README, keeping `/Users/sairamen/projects/Mycelia` as canonical root? (Both currently point at `GodlyDonuts/Mycelia`; re-verified safe.)
2. **AWS account + $100 credit** — provision DSQL through a fresh AWS account via the v0/Vercel Marketplace flow (gets the credit, 6-month clock starts) or link an existing account?
3. **v0 / Vercel plan** — confirm a v0 + Vercel plan that allows the Git panel, GitHub integration, and per-PR preview deploys.
4. **Browser tile kernel** — confirm **plain TypeScript in a Web Worker** for the demo (simpler, lower risk, acceptable for the ~2 s "Join the mesh" wow), with a hand-written WASM/WebGPU kernel deferred to the roadmap? (We will not call it "WASM" until it is.)
5. **Simulator size** — confirm **N=50, T=3 s (~17 writes/sec)** as the demo default; treat **200 nodes as a stretch goal gated on a measured load test**, not an assumed-safe option. All counts route through the shared pool.
6. **Real-node count** — can we get **N≥3** real workers (teammate laptops + 2–3 phone browser tabs) so the genuine-distribution claim is N>2 at near-zero extra risk?
7. **Ledger debit posture for the demo** — confirm requesters are **pre-funded internal accounts** at the hackathon (so real-money overdraft can't occur), while we still implement the per-account serialization row to demonstrate the correct design.
8. **MYC naming / token posture** — keep "MYC credits" as an internal stable-value unit for now (recommended), and defer any tradeable-token decision to Phase 5?
9. **Team split** — who owns the **connection-pooling guardrail incl. the simulator** (#1 priority), who owns the **stateless coordinator + driver/simulator script**, who owns the **ledger serialization + tests**, and who owns the **v0 screens**? Assign the `lib/db/` pooling work to your strongest engineer first.

---

## 15. Why this is 2026 state-of-the-art

Mycelia weaves idle consumer machines into a datacenter-class compute cloud — and in 2026 we can **show** it, not just describe it.

The product is scaffolded by v0 into stable **Next.js 16**, where **Cache Components** paint a prerendered shell the instant the page loads and a client component opens a live stream into it. That stream rides **Server-Sent Events on Vercel Fluid Compute** — long-lived push that used to be impossible on serverless, now first-class, with `after()` handling audit writes off the critical path. No self-hosted WebSockets, no long-running process. The entire read path talks to **one serverless, strongly-consistent Aurora DSQL cluster** over **passwordless Vercel OIDC→IAM federation** — every request mints a fresh 15-minute token, zero credentials stored anywhere.

Then it gets real. A judge types one plain-English sentence and **Claude Opus 4.8** (`claude-opus-4-8`) streams a schema-valid render job and a live cost estimate into the marketplace form — structured outputs re-validated against the same Zod schema that guards `/submit`, so the model can shape a job but never corrupt the ledger. They click **Join the mesh**, and a Chromium tab on our machine — zero install — runs a **WGSL compute shader** that visibly saturates its GPU, feeding deep-zoom fractal tiles into the mesh alongside real laptops, phone tabs, and a simulated fleet until the image reassembles and MYC credits tick up through an **escrow-until-verified ledger that is provably safe against overdraft and replay**.

The cloud itself is an **MCP server**: point Claude at its read-only endpoint and an agent reads the live mesh, inspects job progress, and explains a settlement in plain English — while the ledger stays server-authoritative and the agent can never authorize a payment.

The moat is the roadmap we name precisely: **stake-weighted Proof-of-Sampling plus refereed-delegation recompute** drives verification cost from 2× replication toward logarithmic — the exact lever our unit economics says is the entire business — with **zk-proven deterministic jobs** and **DiLoCo-class decentralized training** as the frontier beyond it. That is the one compute story that needs no new datacenter, no new land, no new grid interconnect — harvesting hardware that already exists.
