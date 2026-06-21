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

## 9. Gotchas (learned the hard way)

- **Never call the module-level `query()`/`withTx()` inside a `withTx` callback.** PGlite has a single connection — a `pg.query` issued while a transaction is open waits for the tx to release, which waits for the callback → **deadlock**. Use the `tx` handle passed into the callback.
- **NUMERIC comes back as a string** from PGlite. Cast `::float8`/`::int` in SQL or wrap with `num()` ([`lib/db/index.ts`](../frontend/lib/db/index.ts)).
- **WebGPU is f32**, the reference is f64 — rely on `verifyTile`'s tolerance, don't expect exact hash matches from the GPU path.
- The DB is **in-memory** by default (re-seeds on restart). Set `MYCELIA_DB_DIR` to persist.

## 10. What's live vs roadmap

**Live:** coordinator, escrow-until-verified ledger, real fractal fan-out + reassembly, WebGPU/CPU browser worker, NL submission, read-only MCP, five screens.
**Roadmap (the moat, unbuilt):** untrusted-result verification (PoSP + refereed-delegation recompute), WASM/Firecracker sandboxing, the native daemon supply engine, SSE-on-Fluid transport, S3 blob pipeline, and the distributed LoRA training layer ([`ML_LAYER.md`](ML_LAYER.md)). Tracked in GitHub issues under the phase milestones.
