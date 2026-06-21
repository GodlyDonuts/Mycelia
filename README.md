# Mycelia

> **A shared compute cloud woven from everyday people's idle computers.** Many small nodes, one living compute organism.

Mycelia is a two-sided marketplace that weaves idle consumer CPUs/GPUs into a datacenter-class compute cloud. Contributors run a lightweight client (a browser tab today, a native daemon tomorrow) and earn **MYC credits** for completing latency-tolerant batch jobs; requesters submit those jobs and pay far below hyperscaler prices. See [`PLAN.md`](PLAN.md) for the full master plan and [`docs/ML_LAYER.md`](docs/ML_LAYER.md) for the distributed-training design.

## What's live right now

This repo contains a **working end-to-end MVP** of the read path, the coordinator, and the escrow-until-verified ledger — running locally with zero cloud dependencies:

- **Live coordinator** — `/submit`, `/pull-work`, `/submit-result`, `/settle` as stateless handlers (PLAN.md §3).
- **Escrow-until-verified ledger** — append-only `ledger_entries` + a per-account `account_balance` serialization row that makes concurrent overdraft impossible (PLAN.md §4). Provably: submitting a job debits escrow atomically; contributors are paid only for **verified** tiles; settlement is idempotent.
- **Real distributed render** — a deterministic deep-zoom Mandelbrot kernel fans out into tiles across a simulated fleet **and** real browser nodes, and **reassembles tile-by-tile into one image** on the Network screen, painted from genuinely-computed pixels.
- **"Join the mesh" browser worker** — zero install. Computes real fractal tiles via a **WGSL WebGPU compute shader** (with live per-tile GPU time), feature-detecting down to a **CPU Web Worker**. Tiles are verified by the server's deterministic self-check and paid through the ledger.
- **Natural-language job submission** — describe a job in plain English; **Claude Opus 4.8** structured output (when `ANTHROPIC_API_KEY` is set) shapes it into a schema-valid spec, re-validated by the same Zod schema that guards `/submit`. Falls back to a deterministic keyword parser with no key.
- **Read-only MCP server** — `/api/mcp` exposes the mesh to agents as 7 tools (`get_mesh_status`, `list_nodes`, `get_job_progress`, `explain_settlement`, `get_market`, `get_training_status`, `get_economics`). Read-only by design — the ledger stays server-authoritative.
- **Distributed LoRA training** — a real, converging data-parallel fine-tune (frozen base + trainable adapter) with a **DiLoCo/FedAvg outer loop**, **canary-loss verification** (bad deltas genuinely rejected), and token-weighted payouts. The Network screen shows the live validation-loss drop, per-node contribution bars, and the Δ-rejected count. An external worker can join via the open pull/contribute API — see [`examples/train_worker.py`](examples/train_worker.py).
- **Verification moat (trust & economics)** — stake-at-risk + reputation + **slashing**: a failed challenge slashes a node's stake and drops its reputation (raising its spot-check rate). Reputation drives the **sellable fraction** — and the Trust screen shows the live unit-economics (proven+cheap-power **+$0.084/node-hour**, unproven+high-power break-even) computed against the current mesh (PLAN §7–8).
- **Observability** — a ledger **reconciliation sweep** (no overdraft; escrow always covers payouts) and an on-stage **health strip** (tiles by status, mesh liveness, trust counters, per-worker heartbeat).
- **Hardening** — Zod validation on every write endpoint + token-bucket rate limiting on public endpoints. **Tests:** 19 Vitest unit tests + a 19-check live integration smoke, run in **CI** (GitHub Actions).
- **Native supply-engine daemon** — a real off-browser OS process ([`daemon/`](daemon)) that harvests idle multicore CPU (worker threads), with idle-only scheduling + a power-cap duty cycle. Same pull/submit protocol as every node.
- **Refereed-delegation recompute** — the Phase-5 moat: a referee binary-searches a disputed tile to the first divergent row and recomputes only that row → **O(log n) verification** (64× speedup), live on the Trust screen.
- **Multiple workload classes** — a per-class verification registry; a second live verifiable workload (**Monte Carlo π**, deterministic → reseed-verified) alongside the fractal render and LoRA training.
- **Auth + roles** — local HMAC-signed sessions with provider/requester roles; submit is role-gated server-side.
- **Host protection** — untrusted kernels run in a capability-denied sandbox (no fs/net/process) with a hard time cap (the Wasmtime/WASI design's buildable slice).
- **MYC redemption** — internal-credit cash-out (bank/gift-card/crypto) with tax/KYC disclosure, balance-gated through the ledger.
- **Seven app screens** (Dashboard, Marketplace, Network, Trust & Economics, Earnings, Health, Landing) + a sign-in flow.

## The database: built real, AWS deferred

The plan targets **Amazon Aurora DSQL**. Per the constraint of this build, **no AWS is provisioned** — instead the entire data layer runs on **PGlite** (embedded Postgres-in-WASM, no install). Because DSQL is Postgres-compatible, the SQL, transactions, OCC-retry wrapper, and shared-connection discipline are the *real* design: swapping in the first-party DSQL connector is a change to a single file ([`frontend/lib/db/index.ts`](frontend/lib/db/index.ts)), not a rewrite.

## Run it

```bash
cd frontend
pnpm install
pnpm dev              # http://localhost:3000
```

Open the **Network** page and click **Join the mesh** to contribute compute from your browser; submit a job from the **Marketplace** (try the plain-English box) and watch it render. For a full click-by-click demo script, see [`docs/DEMO.md`](docs/DEMO.md).

Optional — enable real Claude NL submission:

```bash
export ANTHROPIC_API_KEY=sk-ant-...     # otherwise the keyword fallback is used
# optional: export ANTHROPIC_MODEL=claude-opus-4-8
```

### Test

```bash
cd frontend
pnpm test                # 19 Vitest unit tests (fractal, training, economics, jobspec) — fast, no server

pnpm dev                 # in one terminal
pnpm test:smoke          # in another — 19-check live integration smoke: escrow, overdraft,
                         # cheat-rejection + slashing, verify+pay, idempotency, training
                         # convergence, reconciliation, hardening, and the MCP surface
```

Both run in CI on every PR (GitHub Actions, [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

### Build

```bash
cd frontend && pnpm build
```

## Architecture (as built)

```
Browser (Network/Dashboard/Marketplace/Landing, "Join the mesh" worker)
   │  polling read path + POST coordinator endpoints
   ▼
Next.js 16 route handlers ──► lib/coordinator.ts ──► lib/db (ONE shared PGlite conn)
   │                                  ▲                     │  Postgres-compatible
   │  lib/driver.ts (in-process       │                     ▼  → swap for Aurora DSQL
   │  simulator: keeps the mesh       └── lib/fractal.ts (deterministic kernel,
   │  alive, assembles renders)            isomorphic server/browser, self-verifiable)
   ▼
/api/mcp  (read-only MCP server over JSON-RPC / Streamable HTTP)
```

Key modules: [`lib/coordinator.ts`](frontend/lib/coordinator.ts), [`lib/driver.ts`](frontend/lib/driver.ts), [`lib/fractal.ts`](frontend/lib/fractal.ts), [`lib/db/`](frontend/lib/db), [`lib/reads.ts`](frontend/lib/reads.ts), [`lib/compute-client.ts`](frontend/lib/compute-client.ts), [`lib/mcp-tools.ts`](frontend/lib/mcp-tools.ts).

**Full technical reference:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data model, job lifecycle, ledger invariants, the fractal kernel, the driver, the API surface, the PGlite→DSQL swap, and gotchas. Agent/contributor quickstart: [`CLAUDE.md`](CLAUDE.md). Dev guide: [`frontend/README.md`](frontend/README.md).

## Roadmap

Tracked as GitHub issues across phase milestones (Phase 0 → 6 + the ML training layer). The Regime-1 LoRA training slice and the first cut of the verification moat (stake/slash/reputation + the live economics) are **built** (see above). The hard, unbuilt work that remains: untrusted-result verification **at scale** (PoSP + refereed-delegation recompute, incl. for training), sandboxing untrusted code, the native daemon supply engine, and model-sharded training cells (pipeline/tensor parallel + P2P). See [`PLAN.md`](PLAN.md) §10, [`docs/ML_LAYER.md`](docs/ML_LAYER.md), and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
