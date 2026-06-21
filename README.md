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
- **Read-only MCP server** — `/api/mcp` exposes the mesh to agents as `get_mesh_status`, `list_nodes`, `get_job_progress`, `explain_settlement`. Read-only by design — the ledger stays server-authoritative.
- **Four live screens** — Provider Dashboard, Compute Marketplace + Submit, Live Network Telemetry (the hero), and the Landing page, all reading live data.

## The database: built real, AWS deferred

The plan targets **Amazon Aurora DSQL**. Per the constraint of this build, **no AWS is provisioned** — instead the entire data layer runs on **PGlite** (embedded Postgres-in-WASM, no install). Because DSQL is Postgres-compatible, the SQL, transactions, OCC-retry wrapper, and shared-connection discipline are the *real* design: swapping in the first-party DSQL connector is a change to a single file ([`frontend/lib/db/index.ts`](frontend/lib/db/index.ts)), not a rewrite.

## Run it

```bash
cd frontend
pnpm install
pnpm dev              # http://localhost:3000
```

Open the **Network** page and click **Join the mesh** to contribute compute from your browser; submit a job from the **Marketplace** (try the plain-English box) and watch it render.

Optional — enable real Claude NL submission:

```bash
export ANTHROPIC_API_KEY=sk-ant-...     # otherwise the keyword fallback is used
# optional: export ANTHROPIC_MODEL=claude-opus-4-8
```

### Test

```bash
cd frontend
pnpm dev                 # in one terminal
node test/smoke.mjs      # in another — exercises escrow, overdraft, cheat-rejection,
                         # honest verify+pay, idempotency, and the MCP surface
```

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

Tracked as GitHub issues across phase milestones (Phase 0 → 6 + the ML training layer). The hard, unbuilt work is the moat: untrusted-result verification (PoSP + refereed-delegation recompute), sandboxing untrusted code, the native daemon supply engine, and the distributed LoRA training layer. See [`PLAN.md`](PLAN.md) §10 and [`docs/ML_LAYER.md`](docs/ML_LAYER.md).
