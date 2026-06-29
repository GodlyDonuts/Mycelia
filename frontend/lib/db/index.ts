// Mycelia data-access layer — THE ONLY DB SEAM.
//
// One shared, single connection for the whole process (PLAN.md §4). The backend
// is selected by MYCELIA_DB_DRIVER:
//
//   (unset) | pglite  → embedded Postgres-in-WASM (default; local/dev/test)
//   dsql              → Aurora DSQL  (IAM token + RDS CA TLS + keep-alive + 40001 retry)
//   postgres          → Aurora PostgreSQL / RDS / any DATABASE_URL
//
// The SQL/transactions/OCC-retry are identical across backends — swapping the
// driver is the entire "now it's on AWS" move, and nothing outside lib/db knows
// which backend is live. If a cloud backend can't connect, we fall back to PGlite
// so a demo never hard-fails (the fallback is surfaced on the Cloud console).

import type { Backend, Tx, Sql, Params } from "./types"
import { recordQuery, markFallback, markRetry40001, getDbStatus } from "./status"

export type { Tx } from "./types"
export { getDbStatus } from "./status"
export type { DbStatus } from "./status"

declare global {
  // eslint-disable-next-line no-var
  var __mycelia_backend: Promise<Backend> | undefined
}

// node-postgres connection failures on dual-stack localhost surface as an
// AggregateError with an empty top-level message and the real ECONNREFUSED in
// `.errors[]`; auth failures carry the cause in `.code`. Dig out something useful.
function describeError(err: unknown): string {
  if (err == null) return "unknown error"
  const e = err as { message?: string; code?: string; errors?: Array<{ message?: string; code?: string }> }
  if (Array.isArray(e.errors) && e.errors.length) {
    const parts = e.errors.map((x) => x?.message || x?.code).filter(Boolean)
    if (parts.length) return parts.join("; ")
  }
  if (e.message) return e.code ? `${e.message} (${e.code})` : e.message
  if (e.code) return String(e.code)
  return String(err)
}

async function resolveBackend(): Promise<Backend> {
  const driver = (process.env.MYCELIA_DB_DRIVER ?? "pglite").toLowerCase()

  if (driver === "dsql" || driver === "postgres") {
    try {
      const { createSqlBackend } = await import("./sql")
      const b = await createSqlBackend(driver)
      await b.ready
      return b
    } catch (err) {
      // Don't let a cloud hiccup kill the app — degrade to embedded Postgres and
      // record why, so the Cloud console can show the fallback honestly.
      const reason = describeError(err)
      markFallback(driver, reason)
      console.error(`[mycelia] ${driver} backend unavailable, falling back to PGlite: ${reason}`)
      const { createPgliteBackend } = await import("./pglite")
      const b = createPgliteBackend()
      await b.ready
      return b
    }
  }

  const { createPgliteBackend } = await import("./pglite")
  const b = createPgliteBackend()
  await b.ready
  return b
}

function backend(): Promise<Backend> {
  return (globalThis.__mycelia_backend ??= resolveBackend())
}

/** Returns the shared underlying connection handle, guaranteed migrated +
 *  (if empty) seeded. Callers only await it; the concrete type varies by backend. */
export async function getDb(): Promise<unknown> {
  return (await backend()).handle
}

const t0 = () => (typeof performance !== "undefined" ? performance.now() : Date.now())

/** Convenience query that returns typed rows. */
export async function query<T = Record<string, unknown>>(sql: Sql, params: Params = []): Promise<T[]> {
  const b = await backend()
  const start = t0()
  try {
    return await b.query<T>(sql, params)
  } finally {
    recordQuery(t0() - start)
  }
}

/** Single-row helper (or null). */
export async function queryOne<T = Record<string, unknown>>(sql: Sql, params: Params = []): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

/**
 * Run fn inside a transaction with the mandatory SQLSTATE 40001 retry-with-
 * backoff (PLAN.md §4). Each backend.withTx is ONE attempt; the retry lives here
 * so the contract is identical across drivers. PGlite is single-writer and never
 * raises 40001 on its own, but the wrapper still honors an injected conflict so
 * the swap to a real OCC backend changes nothing for callers.
 */
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const b = await backend()
  const start = t0()
  // DSQL's OCC raises 40001 on write conflicts; under real contention (hot rows
  // like the shared platform/escrow balances) a few conflicts per commit are
  // normal, so retry generously with exponential backoff + jitter. PGlite is
  // single-writer and never reaches the retry, so this only costs on the wire.
  const MAX = 12
  let lastErr: unknown
  try {
    for (let attempt = 0; attempt < MAX; attempt++) {
      try {
        return await b.withTx(fn)
      } catch (err: unknown) {
        lastErr = err
        if ((err as { code?: string })?.code === "40001" && attempt < MAX - 1) {
          markRetry40001()
          const backoff = Math.min(400, 15 * 2 ** attempt) + Math.floor(Math.random() * 25)
          await new Promise((r) => setTimeout(r, backoff))
          continue
        }
        throw err
      }
    }
    throw lastErr
  } finally {
    recordQuery(t0() - start, true)
  }
}

/** Number coercion — Postgres returns NUMERIC columns as strings. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0
  return typeof v === "number" ? v : Number(v)
}

/** True once the active backend is a managed cloud database. */
export function isCloud(): boolean {
  return getDbStatus().cloud
}
