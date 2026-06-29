# AGENTS.md

Guidance for AI agents working in this repo. Mycelia is a two-sided marketplace that weaves idle consumer CPUs/GPUs into a shared compute cloud. See [`README.md`](README.md) for the overview, [`PLAN.md`](PLAN.md) for the master plan, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the deep technical reference.

## Where the code is

The app lives in **`frontend/`** (Next.js 16 App Router, React 19, Tailwind 4, shadcn/Base-UI). All commands run from there.

```bash
cd frontend
pnpm install
pnpm dev      # http://localhost:3000  (in-memory PGlite DB migrates + seeds on first request)
pnpm build    # production build (must stay green)
pnpm test     # node test/smoke.mjs — server must be running in another terminal
```

## How it's built (the one thing to internalize)

The plan targets **Aurora DSQL**, but **no AWS is provisioned**. The entire data layer runs on **PGlite** (embedded Postgres-in-WASM) behind `frontend/lib/db/index.ts`. The SQL/transactions/OCC-retry are the real design; swapping in the DSQL connector is a change to **that one file**. Do not scatter DB access elsewhere — go through `getDb`/`query`/`withTx`/`queryOne` in `lib/db`.

Request flow: client (polling reads + POST) → route handlers in `app/api/*` → `lib/coordinator.ts` (writes) / `lib/reads.ts` (reads) → shared connection. `lib/driver.ts` is the only background loop (the in-process simulator). `lib/fractal.ts` is the deterministic kernel used identically on server and browser.

## Conventions

- Route handlers: `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- Validate job input with `JobSpecSchema` (`lib/jobspec.ts`) — it guards `/submit`; NL output is re-validated against it.
- Client data fetching: use `usePoll` / `useNetwork` from `lib/api.ts`; keep mock constants as the loading fallback so SSR is safe.
- Match the surrounding 2026-flagship aesthetic (deep charcoal, bioluminescent teal/amber); reuse `components/ui` + existing tokens.
- Commit on a feature branch (not `main`); end commit messages with the Co-Authored-By trailer.

## Gotchas

- **Never** call the module-level `query()`/`withTx()` inside a `withTx` callback — PGlite is single-connection, so it deadlocks. Use the `tx` handle.
- **NUMERIC** columns return as **strings** from PGlite — cast `::float8`/`::int` in SQL or use `num()`.
- WebGPU compute is f32 vs the f64 reference — `verifyTile` is tolerance-based; don't expect exact hash matches from the GPU path.
- The DB is in-memory by default (re-seeds on restart); set `MYCELIA_DB_DIR` to persist. Env vars are documented in `frontend/.env.example`.

## Status

**Live:** coordinator (`/submit`,`/pull-work`,`/submit-result`,`/settle`), escrow-until-verified ledger, real fractal fan-out + reassembly, WebGPU/CPU browser worker, NL submission (Codex + fallback), read-only MCP (`/api/mcp`, 7 tools), **distributed LoRA training** (`lib/training/*`; external worker `examples/train_worker.py`), **verification moat** (`lib/verification.ts` stake/slash/reputation + economics; `lib/referee.ts` refereed-delegation recompute = O(log n)), **native daemon** (`daemon/` — off-browser multicore supply engine), **workload registry + Monte Carlo** (`lib/workloads.ts`, `lib/montecarlo.ts`), **auth + roles** (`lib/auth.ts`, `/signin`), **capability sandbox** (`lib/sandbox.ts`), **MYC redemption** (`lib/wallet.ts`), **observability** (`lib/health.ts` reconciliation + Health screen), Zod + rate limiting, seven screens.

**Tests:** `pnpm test` (41 Vitest unit) + `pnpm test:smoke` (29-check live integration, server running). Both in CI (`.github/workflows/ci.yml`).

**Roadmap (unbuilt — needs absent infra):** Aurora DSQL + the async AWS backend (SQS/EventBridge/Fargate), Wasmtime/Firecracker true isolation (no runtime here), zk via SP1, model-sharded training cells + P2P/WebRTC, comm compression, batched-inference/3D workloads, multi-region. Tracked as GitHub issues; implemented ones closed with code pointers. See `docs/ML_LAYER.md` + `docs/ARCHITECTURE.md`.
