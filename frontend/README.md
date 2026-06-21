# Mycelia — frontend + app

The Next.js 16 (App Router, React 19) application: UI, the read path, the stateless coordinator, the escrow-until-verified ledger, the in-process simulator, and the read-only MCP server. The data layer runs on **PGlite** (embedded Postgres) locally and is a one-file swap for **Aurora DSQL** (see [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)).

## Quickstart

```bash
pnpm install
pnpm dev          # http://localhost:3000  (in-memory DB migrates + seeds on first request)
```

Then:
- **Network** → click **Join the mesh** to compute real fractal tiles from your browser (WebGPU, CPU fallback) and watch the image reassemble.
- **Marketplace** → describe a job in plain English (or fill the form) and submit; escrow is debited and the job fans out.
- **Earnings** → the live escrow-until-verified ledger.

## Commands

| Command | What |
|---|---|
| `pnpm dev` | dev server (HMR) |
| `pnpm build` | production build |
| `pnpm start` | serve the production build |
| `pnpm lint` | eslint |
| `pnpm test` | integration smoke test (`node test/smoke.mjs`) — **server must be running** |

## Configuration

Copy `.env.example` → `.env.local` and fill what you need (all optional):

| Var | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | enables real Claude Opus 4.8 NL job parsing; without it, a deterministic keyword fallback is used |
| `ANTHROPIC_MODEL` | override the model id (default `claude-opus-4-8`) |
| `MYCELIA_DB_DIR` | persist the PGlite database to disk instead of in-memory (data survives restarts) |

## Layout

```
app/                  pages (/, /dashboard, /marketplace, /network, /ledger) + api/* route handlers
components/           UI — dashboard/ marketplace/ network/ ledger/ + landing components + ui/
lib/
  db/                 schema.sql + shared PGlite connection (the DSQL swap point) + seed
  coordinator.ts      submit / pull-work / submit-result / settle / register / heartbeat
  reads.ts            read-path queries backing the screens
  driver.ts           in-process simulator (keeps the mesh live, assembles renders)
  fractal.ts          deterministic Mandelbrot kernel (isomorphic, self-verifiable)
  compute-client.ts   browser compute: WebGPU (WGSL) + CPU Web Worker fallback
  api.ts              client pollers + fractal palette
  jobspec.ts          Zod schema that guards /submit
  mcp-tools.ts        read-only MCP tool implementations
public/fractal-worker.js   CPU compute worker (byte-exact mirror of lib/fractal)
test/smoke.mjs        integration smoke test
```

## Notes & gotchas

- The four telemetry widgets share **one** poll loop via `useNetwork()` in `lib/api.ts`.
- Inside a `withTx` callback use the passed `tx` handle — **never** the module-level `query()` (PGlite is single-connection; mixing deadlocks). See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §9.
- `typescript.ignoreBuildErrors` is on (inherited from the v0 scaffold); `pnpm build` still validates bundling.

See [`../README.md`](../README.md) for the project overview and [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the deep technical reference.
