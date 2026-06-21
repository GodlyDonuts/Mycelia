// Mycelia data-access layer.
//
// One shared connection for the whole process (PLAN.md §4 "ONE shared pooled
// connection" discipline). Today the driver is local PGlite (embedded Postgres
// in WASM — no install, no cloud); because the SQL is plain Postgres it swaps
// for the first-party Aurora DSQL connector by replacing only this file.
//
// The singleton is parked on globalThis so Next's dev HMR reuses it instead of
// opening a second instance per module reload.

import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { join } from "node:path"

type Sql = string
type Params = unknown[]

interface MyceliaDb {
  pg: PGlite
  ready: Promise<void>
}

declare global {
  // eslint-disable-next-line no-var
  var __mycelia_db: MyceliaDb | undefined
}

function loadSchema(): string {
  // Read from disk (dev). Path is stable relative to the Next working dir.
  return readFileSync(join(process.cwd(), "lib", "db", "schema.sql"), "utf8")
}

async function bootstrap(pg: PGlite): Promise<void> {
  await pg.exec(loadSchema())
  // Seed only if the mesh is empty so a server restart paints a populated app.
  const { rows } = await pg.query<{ n: number }>("SELECT count(*)::int AS n FROM nodes")
  if (rows[0].n === 0) {
    const { seed } = await import("./seed")
    await seed(pg)
  }
}

function init(): MyceliaDb {
  if (globalThis.__mycelia_db) return globalThis.__mycelia_db
  const dir = process.env.MYCELIA_DB_DIR // optional persistence; defaults to in-memory
  const pg = dir ? new PGlite(dir) : new PGlite()
  const db: MyceliaDb = { pg, ready: bootstrap(pg) }
  globalThis.__mycelia_db = db
  return db
}

/** Returns the shared PGlite instance, guaranteed migrated + seeded. */
export async function getDb(): Promise<PGlite> {
  const db = init()
  await db.ready
  return db.pg
}

/** Convenience query that returns typed rows. */
export async function query<T = Record<string, unknown>>(sql: Sql, params: Params = []): Promise<T[]> {
  const pg = await getDb()
  const res = await pg.query<T>(sql, params)
  return res.rows
}

/** Single-row helper (or null). */
export async function queryOne<T = Record<string, unknown>>(sql: Sql, params: Params = []): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

/**
 * Run fn inside a transaction. On Aurora DSQL this is where the mandatory
 * SQLSTATE 40001 retry-with-backoff lives (PLAN.md §4); PGlite is
 * single-writer so it never raises 40001, but we keep the retry wrapper so the
 * contract is identical when the driver is swapped.
 */
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pg = await getDb()
  const MAX = 5
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX; attempt++) {
    try {
      return await pg.transaction(async (t) => fn(wrapTx(t)))
    } catch (err: unknown) {
      lastErr = err
      const code = (err as { code?: string })?.code
      if (code === "40001") {
        await new Promise((r) => setTimeout(r, 25 * (attempt + 1) + Math.floor(attempt * attempt)))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

export interface Tx {
  query<T = Record<string, unknown>>(sql: Sql, params?: Params): Promise<T[]>
  queryOne<T = Record<string, unknown>>(sql: Sql, params?: Params): Promise<T | null>
}

function wrapTx(t: { query: PGlite["query"] }): Tx {
  return {
    async query<T>(sql: Sql, params: Params = []) {
      const res = await t.query<T>(sql, params)
      return res.rows
    },
    async queryOne<T>(sql: Sql, params: Params = []) {
      const res = await t.query<T>(sql, params)
      return (res.rows[0] as T) ?? null
    },
  }
}

/** Number coercion — PGlite returns NUMERIC columns as strings. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0
  return typeof v === "number" ? v : Number(v)
}
