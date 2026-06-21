# Mycelia — Implementation Architecture

> How the **working MVP** in `frontend/` is built. Companion to [`../PLAN.md`](../PLAN.md) (the master plan) and [`ML_LAYER.md`](ML_LAYER.md) (the training-layer design). This document describes what is *actually implemented and running*, not the roadmap.

## 1. The shape of it

```
Browser (Next.js client components, polling read path + POST coordinator calls)
   │
   ▼
Next.js 16 App Router (route handlers under app/api/*)
   │
   ├── lib/coordinator.ts   submitJob · pullWork · submitResult · settle · register · heartbeat
   ├── lib/reads.ts         getDashboard · getNetwork · getActiveRender · getMarketplace · getStats · getLedger
   ├── lib/driver.ts        in-process simulator (the only background loop) — keeps the mesh live
   ├── lib/fractal.ts       deterministic Mandelbrot kernel (isomorphic server/browser)
   ├── lib/mcp-tools.ts     read-only MCP tool implementations
   │
   ▼
lib/db/index.ts  ──►  ONE shared PGlite connection (embedded Postgres-in-WASM)
                      migrate + seed on first access; globalThis singleton
                      ↳ swap for the Aurora DSQL connector here (one file)
```

Everything that touches state goes through the single shared connection. The SQL is plain Postgres ([`lib/db/schema.sql`](../frontend/lib/db/schema.sql)) so the entire layer ports to **Aurora DSQL** by replacing only `lib/db/index.ts`.

## 2. Data model

Defined in [`frontend/lib/db/schema.sql`](../frontend/lib/db/schema.sql) (mirrors PLAN.md §5). Integrity is enforced in-app within transactions (no FKs), for DSQL parity. Enums are `TEXT + CHECK`.

| Table | Role |
|---|---|
| `users` | accounts (provider / requester / both) |
| `account_balance` | **debit serialization point** — `available_myc` / `reserved_myc`; conditional UPDATE per escrow_hold |
| `nodes` | mesh nodes (`is_simulated` distinguishes the simulated fleet from real/browser nodes) |
| `node_telemetry_current` | bounded **one-row-per-node** UPSERT (cpu/gpu/ram/earnings) — not an append log |
| `jobs` | job + tile counts + `reward_bid_myc` + status |
| `tiles` | per-tile pixel/complex rect, status state-machine, `result_uri` (inline base64), `result_hash` |
| `tile_results` | submitted results + vote status |
| `ledger_entries` | **append-only**, signed `amount_myc`, `entry_type`, `UNIQUE idempotency_key` |
| `market_snapshots`, `net_events`, `reputation_events` | telemetry / market / events |
| `training_jobs`, `training_rounds`, `cells`, `contributions` | ML-layer tables (schema only; demo unbuilt) |

## 3. Job lifecycle (the render path)

```
SUBMIT      submitJob(): one tx — conditional debit on account_balance (overdraft-safe),
   │        insert job + all tile rows (status='pending'), write escrow_hold ledger entry.
   ▼
CLAIM       pullWork(): randomized conditional UPDATE ... WHERE status='pending' RETURNING,
   │        wrapped in withTx (carries the 40001 retry contract for DSQL).
   ▼
COMPUTE     a node computes the tile — server-side (driver, simulated nodes) or in the
   │        browser (WebGPU/CPU worker). Same deterministic kernel everywhere.
   ▼
VERIFY+PAY  submitResult(): recompute reference + compare (verifyTile, FP-tolerant);
   │        on pass, one tx flips tile→verified, inserts provider_earn + platform_fee,
   │        decrements requester reserved, bumps node earnings. Idempotent (status<>'verified').
   ▼
SETTLE      on the last verified tile → settle(): re-checks all-verified server-side, finalizes.
```

### Ledger invariants (enforced + smoke-tested)
- **No overdraft:** the per-account `account_balance` conditional UPDATE (`WHERE available_myc >= $amt`) makes two concurrent submits collide; one fails the funds check. (`/api/submit` returns **402** on insufficient funds.)
- **Pay only verified work:** payouts happen inside the same tx that flips the tile to `verified`.
- **Idempotent:** re-submitting an already-verified tile does not double-pay (`UPDATE ... WHERE status<>'verified'` returns nothing → no payout); `idempotency_key` is `UNIQUE`.
- **Derived provider balance:** a provider's balance = `SUM(provider_earn)` for that account.

These are exercised by [`frontend/test/smoke.mjs`](../frontend/test/smoke.mjs).

## 4. The fractal workload

[`frontend/lib/fractal.ts`](../frontend/lib/fractal.ts) is a pure, dependency-free Mandelbrot kernel that runs **identically** on the server (driver + verification) and in the browser (`public/fractal-worker.js` mirrors it byte-for-byte). One byte per pixel (iteration count). `verifyTile()` recomputes the reference and compares with a small per-pixel tolerance, so the WebGPU f32 path passes against the f64 reference while garbage still fails. Tiles are small enough to inline as base64 in `tiles.result_uri` (honors the ≤16KB rule); the Network screen reassembles them onto a `<canvas>` from a palette ([`lib/api.ts::tileImageData`](../frontend/lib/api.ts)).

## 5. The driver / simulator

[`frontend/lib/driver.ts`](../frontend/lib/driver.ts) is the single background loop (legitimate because the Next dev server *is* our long-lived local process — PLAN.md §3). Every ~1.3s it: ensures an active render exists (rolls a new deep-zoom into a new neighbourhood when one finishes), has simulated nodes claim+compute+submit a handful of tiles, and jitters telemetry. It calls the same coordinator functions and shared connection as everything else. Started lazily by the read routes (`startDriver()`); guarded on `globalThis`.

## 6. API reference

**Coordinator (POST):** `/api/submit`, `/api/pull-work`, `/api/submit-result`, `/api/settle`, `/api/nodes/register`, `/api/heartbeat`.
**Read (GET):** `/api/dashboard`, `/api/network`, `/api/render/active`, `/api/marketplace`, `/api/stats`, `/api/ledger`.
**AI:** `/api/jobs/parse` (POST, NL→JobSpec). **MCP:** `/api/mcp` (GET discovery; POST JSON-RPC: `initialize`, `tools/list`, `tools/call`, `ping`).

All route handlers are `runtime = "nodejs"`, `dynamic = "force-dynamic"`.

## 7. AI surfaces

- **NL submission** ([`app/api/jobs/parse/route.ts`](../frontend/app/api/jobs/parse/route.ts)): calls Claude Opus 4.8 with a forced `create_job` tool when `ANTHROPIC_API_KEY` is set, else a deterministic keyword parser. **Either way** the output is re-validated against `JobSpecSchema` ([`lib/jobspec.ts`](../frontend/lib/jobspec.ts)) before it can reach `/submit`.
- **MCP** ([`app/api/mcp/route.ts`](../frontend/app/api/mcp/route.ts), [`lib/mcp-tools.ts`](../frontend/lib/mcp-tools.ts)): read-only. Tools: `get_mesh_status`, `list_nodes`, `get_job_progress`, `explain_settlement`. No mutating tools; `/settle` is not exposed.

## 8. Swapping PGlite → Aurora DSQL

Only [`frontend/lib/db/index.ts`](../frontend/lib/db/index.ts) changes: replace the PGlite instance with the first-party DSQL Node connector (cached IAM token, `attachDatabasePool`), keeping the same `getDb`/`query`/`withTx` surface. The `withTx` wrapper already implements the SQLSTATE **40001 retry-with-backoff** that DSQL's OCC requires. `schema.sql` and all callers are unchanged.

**Doing this migration?** [`docs/AWS_ONBOARDING.md`](AWS_ONBOARDING.md) is the step-by-step onboarding guide — the exact `lib/db` contract, a ready-to-fill DSQL connector sketch (IAM token + TLS + keep-alive), the Phase-3 work sequenced by dependency, and the acceptance gate that must stay green against DSQL.

## 9. Gotchas (learned the hard way)

- **Never call the module-level `query()`/`withTx()` inside a `withTx` callback.** PGlite has a single connection — a `pg.query` issued while a transaction is open waits for the tx to release, which waits for the callback → **deadlock**. Use the `tx` handle passed into the callback.
- **NUMERIC comes back as a string** from PGlite. Cast `::float8`/`::int` in SQL or wrap with `num()` ([`lib/db/index.ts`](../frontend/lib/db/index.ts)).
- **WebGPU is f32**, the reference is f64 — rely on `verifyTile`'s tolerance, don't expect exact hash matches from the GPU path.
- The DB is **in-memory** by default (re-seeds on restart). Set `MYCELIA_DB_DIR` to persist.

## 10. Distributed training (the AI/ML backend)

A second live workload class implementing the Regime-1 demo slice of [`ML_LAYER.md`](ML_LAYER.md): **data-parallel LoRA fine-tuning with a DiLoCo/FedAvg outer loop and canary-loss verification.** Real, converging, in-process.

- **Model** ([`lib/training/model.ts`](../frontend/lib/training/model.ts)): a *frozen base* (fixed random feature projection) + a *trainable low-rank adapter* — the LoRA-spirit setup shrunk to a tractable supervised task so it runs in-process and converges visibly (val loss ~0.13 → ~0.005 over a handful of rounds). Real SGD for local steps; **token-weighted FedAvg** and a **DiLoCo** outer optimizer (Nesterov momentum on the averaged pseudo-gradient). Only the inner workload is small — the outer loop is the real architecture; a Python PyTorch+PEFT worker would implement the same pull/contribute contract.
- **Lifecycle** ([`lib/training/coordinator.ts`](../frontend/lib/training/coordinator.ts)): `submitTrainingJob` (escrow) → per-round **cell formation** (Regime 1: one node per cell, heterogeneous shards) → `pullRoundTask` → local SGD → `submitContribution` (**canary-loss verification** + cosine sanity → accept/reject) → **aggregation worker** (token-weighted FedAvg → new global adapter, validation loss, token-weighted payouts) → next round until target loss / max rounds. Bounded-staleness flush handles dropped nodes.
- **Verification** (ML_LAYER §7, demo-grade): a contribution is accepted only if its adapter holds-or-reduces loss on a coordinator-controlled **canary batch** within a relative tolerance; garbage/poisoned deltas blow the canary up and are rejected. (Refereed-recompute is roadmap.)
- **Driver** ([`lib/training/driver.ts`](../frontend/lib/training/driver.ts)): simulates heterogeneous cells running real SGD, injecting one deliberately-bad delta per ~most rounds so the canary rejection is visible on stage.
- **API:** `POST /api/training/submit` · `POST /api/training/pull` · `POST /api/training/submit-contribution` · `GET /api/training/active`. **UI:** the **Distributed Training** panel on the Network screen shows the live loss-drop curve, token-weighted contribution bars, and the "Δ rejected" count.

## 11. Verification moat & economics

The first cut of the differentiator (PLAN §7–8), kept honest as two separate claims (ledger = provably safe; verification = stake-weighted, negative-EV).
- Nodes carry `stake_myc`, `reputation`, `spot_checks`, `challenges_failed`. A failed self-check **slashes** stake (`ledger 'slash'`), drops reputation, and returns the tile to the pool — cheating is negative-EV; a pass raises reputation. ([`lib/coordinator.ts`](../frontend/lib/coordinator.ts) `submitResult`.)
- Reputation → spot-check rate → **effective replication** → **sellable fraction**, the dominant term in the unit economics. The **Trust & Economics** screen (`/verification`) shows the live sellable fraction, verification tax, stake at risk, cheats slashed, reputation leaderboard, and the §7 worked unit-economics computed against the current mesh. ([`lib/verification.ts`](../frontend/lib/verification.ts).)
- The render driver injects ~9% malicious nodes so the trust layer has real cheats to catch.

## 12. Observability & hardening

- **Reconciliation sweep** ([`lib/health.ts`](../frontend/lib/health.ts)): no `account_balance` row may go negative; per-job payouts+refunds never exceed escrow held. Surfaced on the **Health** screen (`/health`) with render/training status, mesh liveness, trust counters, and per-worker heartbeat age. (This sweep caught a real sub-cent `splitReward` rounding drift.)
- **Hardening:** every write endpoint validates its body with a Zod schema ([`lib/contracts.ts`](../frontend/lib/contracts.ts)) → clean 400s; public endpoints are rate-limited via a token bucket ([`lib/http.ts`](../frontend/lib/http.ts)).
- **Tests:** 19 Vitest unit tests (`test/unit/`) + a 19-check live integration smoke (`test/smoke.mjs`), both in CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

## 13. What's live vs roadmap

**Live:** coordinator, escrow-until-verified ledger, real fractal fan-out + reassembly, WebGPU/CPU browser worker, **native off-browser daemon** (`daemon/`), NL submission, read-only MCP (7 tools), distributed LoRA training (DiLoCo/FedAvg + canary; external worker via `examples/train_worker.py`), **model-sharded training cells — pipeline + tensor parallel, each proven gradient-identical to a monolithic node** (`lib/training/pipeline.ts`, `tensor.ts`), **pipeline-parallel inference serving** (`serve()`, forward-equivalent), **heterogeneity-aware pipeline partitioning** (`lib/training/partition.ts`), **communication compression — top-k + int8 + error feedback** (`lib/training/compress.ts`), the verification moat in three modes — **self-check, refereed-delegation recompute** (`lib/referee.ts`, O(log n)) **and adaptive N-of-M majority voting** (`lib/replication.ts`) — over **stake/slash/reputation + live economics**, **refereed-recompute + directional-agreement for training** (`lib/training/refereed.ts`), **capability-denied sandbox** (`lib/sandbox.ts`), **workload registry + Monte Carlo + batched inference** (three verifiable workload classes), **auth + provider/requester roles**, **MYC redemption**, **region-aware payouts + off-peak scheduling + SLA tiers**, observability (reconciliation + health), SSE live beat, Zod + rate limiting, seven screens, CI (74 unit + 33 smoke + ledger fuzz).
**Roadmap (needs infra absent from this environment):** Aurora DSQL + the async AWS backend (API Gateway/Lambda/SQS/EventBridge/Fargate); **true** WASM/WASI isolation via Wasmtime + Firecracker/gVisor (no runtime here — only the capability slice is built); zk-proven jobs via SP1; real P2P/WebRTC activation transport between sharded cells (the parallelism math is built and proven in-process; only the wire is stubbed); full pretraining + ZeRO offload; 3D/video render workload; multi-region deployment. Tracked in GitHub issues under the phase milestones.
