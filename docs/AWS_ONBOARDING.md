# AWS Integration — Onboarding

Welcome. You're here to put Mycelia on real AWS. **The good news: the application
is done and the data layer was built to be swapped.** Everything runs today on an
embedded Postgres (PGlite) that stands in for **Aurora DSQL**. Your job is to
replace that stand-in with real cloud infrastructure *without changing application
code* — the SQL, transactions, and optimistic-concurrency retry are already the
real DSQL design.

This doc gets you from `git clone` to a clear, sequenced plan in ~30 minutes.

---

## 0. The one idea to internalize

> **All database access goes through one file: [`frontend/lib/db/index.ts`](../frontend/lib/db/index.ts).**
> Nothing else in the codebase opens a connection or knows what the backend is.
> Swap that file's driver from PGlite to Aurora DSQL and the entire app is on AWS.

The SQL is plain Postgres. `schema.sql` is foreign-key-free on purpose (DSQL has
no FKs — integrity is enforced in-app inside transactions). The `withTx` wrapper
**already implements** the SQLSTATE `40001` retry-with-backoff that DSQL's OCC
requires. There is a unit test that pins that contract ([`test/unit/retry.test.ts`](../frontend/test/unit/retry.test.ts)).

So the core migration (issues [#45](https://github.com/GodlyDonuts/Mycelia/issues/45), [#51](https://github.com/GodlyDonuts/Mycelia/issues/51), [#42](https://github.com/GodlyDonuts/Mycelia/issues/42), [#9](https://github.com/GodlyDonuts/Mycelia/issues/9)) is **one file plus IAM/TLS plumbing**. The rest of Phase 3 is moving the in-process simulator's responsibilities onto managed AWS services.

---

## 1. Run it locally first (15 min)

```bash
git clone https://github.com/GodlyDonuts/Mycelia
cd Mycelia/frontend
pnpm install
pnpm dev                       # http://localhost:3000 — DB migrates + seeds on first request
```

Open the app and watch the **Network** screen: a fractal hero assembling from real
distributed tiles, nodes claiming work, a malicious node getting slashed. That is
the live system you must keep green after the swap.

Then run the test suites (these are your **definition of done** — they must still
pass against DSQL):

```bash
pnpm test                      # 86 unit tests (no server needed)
# in a second terminal, with `pnpm dev` running:
pnpm test:smoke                # 34 live API/economics checks
pnpm test:statemachine         # 8 claim/verify-lifecycle invariants
pnpm test:fuzz                 # ledger invariants across randomized interleavings
```

The full GO/NO-GO checklist is [`docs/ACCEPTANCE.md`](ACCEPTANCE.md). Read it — a
failing economic invariant is a NO-GO regardless of how good the rest looks.

---

## 2. How the system is shaped

```
client (browser worker / daemon)
  │  POST /submit, /pull-work, /submit-result, /settle, /heartbeat   (+ polling/SSE reads)
  ▼
app/api/*  (Next.js route handlers — runtime="nodejs", dynamic="force-dynamic")
  │
  ├── writes → lib/coordinator.ts   (submitJob, pullWork, submitResult, settle, …)
  ├── reads  → lib/reads.ts
  │
  ▼
lib/db/index.ts   ← THE ONLY DB SEAM  →  PGlite today / Aurora DSQL after you
```

- **`lib/driver.ts`** is an in-process loop that simulates the supply side (nodes
  pulling/computing/submitting) so the demo is alive with no real fleet. On AWS
  this responsibility moves to **Fargate workers** ([#44](https://github.com/GodlyDonuts/Mycelia/issues/44), [#55](https://github.com/GodlyDonuts/Mycelia/issues/55), [#70](https://github.com/GodlyDonuts/Mycelia/issues/70), [#84](https://github.com/GodlyDonuts/Mycelia/issues/84), [#110](https://github.com/GodlyDonuts/Mycelia/issues/110)). It is **local-only** — do not ship it to prod.
- **`lib/fractal.ts`** is the deterministic kernel, identical on server and browser
  — that determinism is what makes results self-verifiable. Don't touch it.

Full technical reference: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) (§8 is the swap, §9 the gotchas).

---

## 3. Your integration surface — the exact contract

Reimplement these exports in `lib/db/index.ts`. **Keep the signatures identical**;
every caller depends on them and nothing else.

```ts
getDb(): Promise<Conn>                                   // shared, pooled connection
query<T>(sql, params?): Promise<T[]>                     // typed rows
queryOne<T>(sql, params?): Promise<T | null>             // first row or null
withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T>        // transaction + 40001 retry
num(v): number                                           // NUMERIC-as-string coercion
interface Tx { query(...); queryOne(...) }               // the in-transaction handle
```

**Hard requirements for the DSQL implementation** (most are already encoded — keep them):

| Requirement | Why | Status |
|---|---|---|
| **ONE pooled connection** for the process | DSQL connection limits + the app's serialization discipline | enforced today (singleton); keep it |
| **40001 retry-with-backoff** in `withTx` | DSQL OCC raises `40001` on write conflict; caller must retry | **already implemented + tested** ([#79](https://github.com/GodlyDonuts/Mycelia/issues/79)) |
| **IAM token auth, ~15-min expiry** — no static password | [#51](https://github.com/GodlyDonuts/Mycelia/issues/51) | **you build** — mint via `@aws-sdk/dsql-signer`, cache & refresh before expiry |
| **TLS with the Amazon RDS CA bundle** — not `rejectUnauthorized:false` | [#42](https://github.com/GodlyDonuts/Mycelia/issues/42) | **you build** |
| **Keep-alive ping (~4 min)** so the cluster doesn't scale-to-zero mid-demo | [#63](https://github.com/GodlyDonuts/Mycelia/issues/63) | **you build** |
| Treat **NUMERIC as string** (use `num()` / `::float8`) | Postgres wire returns NUMERIC as text | callers already do this; keep `num()` |
| **No foreign keys** in schema | DSQL doesn't support them; integrity is in-app | `schema.sql` is already FK-free |

### Starting-point sketch (node-postgres + DSQL signer)

This is a skeleton, not finished code — fill in pool config, token refresh, and
the CA bundle. The surface matches what callers expect.

```ts
import { Pool } from "pg"
import { DsqlSigner } from "@aws-sdk/dsql-signer"
import { readFileSync } from "node:fs"

declare global { var __mycelia_pool: Pool | undefined }

async function makePool(): Promise<Pool> {
  const signer = new DsqlSigner({ hostname: process.env.DSQL_ENDPOINT!, region: process.env.AWS_REGION! })
  const token = await signer.getDbConnectAdminAuthToken()      // ~15-min IAM token (#51)
  const pool = new Pool({
    host: process.env.DSQL_ENDPOINT, port: 5432, database: "postgres", user: "admin",
    password: token, max: 1,                                    // ONE connection (keep the discipline)
    ssl: { ca: readFileSync(process.env.DSQL_CA_BUNDLE!), rejectUnauthorized: true }, // (#42)
  })
  // TODO: refresh the token before it expires; keep-alive ping every ~4 min (#63)
  return pool
}

export async function getDb(): Promise<Pool> {
  return (globalThis.__mycelia_pool ??= await makePool())
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await (await getDb()).query(sql, params)).rows as T[]
}
export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(sql, params))[0] ?? null
}

export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = await getDb()
  const MAX = 5
  for (let attempt = 0; attempt < MAX; attempt++) {
    const c = await pool.connect()
    try {
      await c.query("BEGIN")
      const wrap: Tx = {
        query: async (s, p = []) => (await c.query(s, p)).rows,
        queryOne: async (s, p = []) => (await c.query(s, p)).rows[0] ?? null,
      }
      const out = await fn(wrap)
      await c.query("COMMIT")
      return out
    } catch (err: any) {
      await c.query("ROLLBACK").catch(() => {})
      if (err?.code === "40001" && attempt < MAX - 1) {        // DSQL OCC conflict → retry
        await new Promise(r => setTimeout(r, 25 * (attempt + 1)))
        continue
      }
      throw err
    } finally { c.release() }
  }
  throw new Error("unreachable")
}

export const num = (v: unknown) => v == null ? 0 : typeof v === "number" ? v : Number(v)
```

> **Bootstrap difference:** locally, `schema.sql` is applied + seeded on first
> access. On DSQL you'll run `schema.sql` once as a migration (no auto-seed in
> prod). The `seed()` import in the current file is dev-only — drop it.

> **Critical gotcha (don't lose it in the rewrite):** never call the module-level
> `query()`/`withTx()` inside a `withTx` callback — use the `tx` handle. With a
> single connection this deadlocks; the app already follows this rule, so don't
> reintroduce module-level calls inside transactions.

---

## 4. The rest of Phase 3, sequenced

Milestone: **[Phase 3 — Async AWS Backend](https://github.com/GodlyDonuts/Mycelia/milestone/4)**. Suggested order (each builds on the last):

1. **Provision + connect (the unblock).** [#45](https://github.com/GodlyDonuts/Mycelia/issues/45) provision Aurora DSQL · [#51](https://github.com/GodlyDonuts/Mycelia/issues/51) OIDC→IAM + 15-min tokens · [#42](https://github.com/GodlyDonuts/Mycelia/issues/42) CA validation · [#9](https://github.com/GodlyDonuts/Mycelia/issues/9) finalize the `lib/db` swap · [#63](https://github.com/GodlyDonuts/Mycelia/issues/63) keep-alive · [#68](https://github.com/GodlyDonuts/Mycelia/issues/68) measure scale-to-zero resume latency. **At the end of step 1 the whole app runs on DSQL and the test suites pass.**
2. **Edge endpoints.** API Gateway + Lambda for the hot paths: [#11](https://github.com/GodlyDonuts/Mycelia/issues/11) intake · [#13](https://github.com/GodlyDonuts/Mycelia/issues/13) pull-work · [#15](https://github.com/GodlyDonuts/Mycelia/issues/15) heartbeat · [#21](https://github.com/GodlyDonuts/Mycelia/issues/21) result-submit. These mirror the existing `app/api/*` handlers — same request/response contracts (see `lib/contracts.ts`).
3. **Async fabric.** [#26](https://github.com/GodlyDonuts/Mycelia/issues/26) SQS tile-dispatch queue + DLQ · [#32](https://github.com/GodlyDonuts/Mycelia/issues/32) EventBridge settlement-events bus.
4. **Workers (replace `lib/driver.ts`).** Fargate: [#44](https://github.com/GodlyDonuts/Mycelia/issues/44) scheduler/capability-matching · [#55](https://github.com/GodlyDonuts/Mycelia/issues/55) straggler/speculative/retry · [#70](https://github.com/GodlyDonuts/Mycelia/issues/70) verification worker · [#84](https://github.com/GodlyDonuts/Mycelia/issues/84) settlement worker (writes the ledger with the 40001 retry) · [#110](https://github.com/GodlyDonuts/Mycelia/issues/110) migrate coordinator timing off the local script.
5. **Blob storage.** [#131](https://github.com/GodlyDonuts/Mycelia/issues/131) S3 result-blobs + tile-scoped presigned PUT/GET (≤16KB inline rule) · [#133](https://github.com/GodlyDonuts/Mycelia/issues/133) dataset sharding + presigned shard refs · [#76](https://github.com/GodlyDonuts/Mycelia/issues/76) worker uploads adapter delta to S3, records ref in DSQL.
6. **Deploy + durability + multi-region.** [#40](https://github.com/GodlyDonuts/Mycelia/issues/40) Vercel per-PR previews · [#97](https://github.com/GodlyDonuts/Mycelia/issues/97) durable settlement saga · [#54](https://github.com/GodlyDonuts/Mycelia/issues/54) multi-region active-active DSQL.

Related compliance items that ride on real infra: [#116](https://github.com/GodlyDonuts/Mycelia/issues/116) geofence + KYC.

> The application logic these services wrap is already written and tested. Where a
> worker needs the "what" (claim a tile, verify, settle), read the matching
> function in `lib/coordinator.ts` — that's the reference behavior to preserve.

---

## 5. Definition of done

For **each** milestone step, the same gate must stay green — now pointed at AWS:

- `pnpm test` (86 unit) — unchanged; pure logic.
- `pnpm test:smoke` / `:statemachine` / `:fuzz` against the deployed stack — the
  economic invariants (no overdraft, no double-pay, escrow conservation) must hold
  on DSQL exactly as on PGlite. These are in CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)); wire the deployed URL in via `BASE`.
- `GET /api/health` reconciliation clean: `negativeBalances == 0`, `overspentJobs == 0`.

If DSQL's real concurrency surfaces a `40001` path the single-writer PGlite never
exercised, that's expected — the retry wrapper handles it; verify under load.

---

## 6. Environment variables

Current ([`frontend/.env.example`](../frontend/.env.example)):

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | optional — real NL job parsing (deterministic fallback otherwise) |
| `ANTHROPIC_MODEL` | NL model id (default `claude-opus-4-8`) |
| `MYCELIA_DB_DIR` | optional PGlite persistence dir (local only) |

You will add (suggested names — wire them in `lib/db/index.ts`):

| Var | Purpose |
|---|---|
| `DSQL_ENDPOINT` | Aurora DSQL cluster hostname |
| `AWS_REGION` | region for the DSQL signer |
| `DSQL_CA_BUNDLE` | path to the Amazon RDS CA bundle for TLS ([#42](https://github.com/GodlyDonuts/Mycelia/issues/42)) |
| `S3_RESULT_BUCKET` | result-blob bucket ([#131](https://github.com/GodlyDonuts/Mycelia/issues/131)) |

Auth to AWS should be **OIDC→IAM federation**, not static keys ([#51](https://github.com/GodlyDonuts/Mycelia/issues/51)). Update `.env.example` as you add vars.

---

## 7. Key files map

| Path | What |
|---|---|
| [`frontend/lib/db/index.ts`](../frontend/lib/db/index.ts) | **your seam** — the only place the backend lives |
| [`frontend/lib/db/schema.sql`](../frontend/lib/db/schema.sql) | Postgres-compatible, FK-free DDL — run as a migration on DSQL |
| [`frontend/lib/coordinator.ts`](../frontend/lib/coordinator.ts) | the write logic Fargate workers must preserve |
| [`frontend/lib/contracts.ts`](../frontend/lib/contracts.ts) | Zod request schemas = the API contracts for Lambda |
| [`frontend/lib/driver.ts`](../frontend/lib/driver.ts) | local simulator — **replace with Fargate, don't deploy** |
| [`frontend/test/`](../frontend/test/) | unit + smoke + statemachine + fuzz — your acceptance gate |
| [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | deep reference (§8 swap, §9 gotchas) |
| [`docs/ACCEPTANCE.md`](ACCEPTANCE.md) | GO/NO-GO checklist |
| [`PLAN.md`](../PLAN.md) | the master plan (§3 coordinator, §4 data discipline) |

---

## 8. First day, concretely

1. Run it locally; watch the Network screen; run the four test suites green.
2. Read `lib/db/index.ts` end-to-end (it's ~120 lines) and §8/§9 of ARCHITECTURE.md.
3. Stand up a DSQL cluster ([#45](https://github.com/GodlyDonuts/Mycelia/issues/45)), get IAM-token auth working ([#51](https://github.com/GodlyDonuts/Mycelia/issues/51)).
4. Rewrite `lib/db/index.ts` against DSQL (sketch in §3); run `schema.sql` as a migration.
5. Run `pnpm test:smoke && pnpm test:statemachine && pnpm test:fuzz` against the
   DSQL-backed app. **When they're green, the app is on AWS** — everything after
   that (Lambda/SQS/Fargate/S3) is moving the simulator's job onto managed services.

Questions: the architecture rationale is in `PLAN.md` and `docs/ARCHITECTURE.md`;
behavior questions are answered by the tests in `frontend/test/`.
