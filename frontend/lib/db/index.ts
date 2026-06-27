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
import { DsqlSigner } from "@aws-sdk/dsql-signer"
import { Pool, type PoolClient } from "pg"
import { readFileSync } from "node:fs"
import { join } from "node:path"

type Sql = string
type Params = unknown[]

interface PgliteDb {
  pg: PGlite
  ready: Promise<void>
}

interface DsqlDb {
  pool: Pool
  tokenExpiresAt: number
}

type DbConn = PGlite | Pool

declare global {
  // eslint-disable-next-line no-var
  var __mycelia_pglite_db: PgliteDb | undefined
  // eslint-disable-next-line no-var
  var __mycelia_dsql_db: DsqlDb | undefined
  // eslint-disable-next-line no-var
  var __mycelia_dsql_keep_alive_started: boolean | undefined
}

const DSQL_TOKEN_TTL_MS = 14 * 60 * 1000
const DSQL_TOKEN_REFRESH_SKEW_MS = 60 * 1000
const DSQL_KEEP_ALIVE_MS = 4 * 60 * 1000

function useDsql(): boolean {
  return process.env.MYCELIA_DB_BACKEND === "dsql"
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

function initPglite(): PgliteDb {
  if (globalThis.__mycelia_pglite_db) return globalThis.__mycelia_pglite_db
  const dir = process.env.MYCELIA_DB_DIR // optional persistence; defaults to in-memory
  const pg = dir ? new PGlite(dir) : new PGlite()
  const db: PgliteDb = { pg, ready: bootstrap(pg) }
  globalThis.__mycelia_pglite_db = db
  return db
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required when MYCELIA_DB_BACKEND=dsql`)
  return value
}

function normalizeHost(value: string): string {
  return value.replace(/^postgres(?:ql)?:\/\//, "").replace(/^https?:\/\//, "").split(/[/:]/)[0]
}

async function makeDsqlPool(): Promise<DsqlDb> {
  const hostname = normalizeHost(requireEnv("DSQL_ENDPOINT"))
  const region = requireEnv("AWS_REGION")
  const caPath = requireEnv("DSQL_CA_BUNDLE")
  const signer = new DsqlSigner({ hostname, region, expiresIn: Math.floor(DSQL_TOKEN_TTL_MS / 1000) })
  const password = process.env.DSQL_USE_ADMIN_TOKEN === "false"
    ? await signer.getDbConnectAuthToken()
    : await signer.getDbConnectAdminAuthToken()

  const pool = new Pool({
    host: hostname,
    port: Number(process.env.DSQL_PORT ?? 5432),
    database: process.env.DSQL_DATABASE ?? "postgres",
    user: process.env.DSQL_USER ?? "admin",
    password,
    max: Number(process.env.DSQL_POOL_MAX ?? 1),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true },
  })

  return { pool, tokenExpiresAt: Date.now() + DSQL_TOKEN_TTL_MS }
}

async function getDsql(): Promise<Pool> {
  const current = globalThis.__mycelia_dsql_db
  if (current && Date.now() < current.tokenExpiresAt - DSQL_TOKEN_REFRESH_SKEW_MS) return current.pool

  await current?.pool.end().catch(() => {})
  const next = await makeDsqlPool()
  globalThis.__mycelia_dsql_db = next

  if (!globalThis.__mycelia_dsql_keep_alive_started) {
    globalThis.__mycelia_dsql_keep_alive_started = true
    setInterval(() => {
      void getDsql().then((pool) => pool.query("SELECT 1")).catch(() => {})
    }, DSQL_KEEP_ALIVE_MS).unref?.()
  }

  return next.pool
}

/** Returns the shared database connection. PGlite is migrated/seeded; DSQL is migrated explicitly. */
export async function getDb(): Promise<DbConn> {
  if (useDsql()) return getDsql()
  const db = initPglite()
  await db.ready
  return db.pg
}

/** Convenience query that returns typed rows. */
export async function query<T = Record<string, unknown>>(sql: Sql, params: Params = []): Promise<T[]> {
  if (useDsql()) {
    const res = await (await getDsql()).query(sql, params)
    return res.rows as T[]
  }
  const pg = await getDb() as PGlite
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
  const MAX = 5
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX; attempt++) {
    try {
      if (useDsql()) return await withDsqlTx(fn)
      const pg = await getDb() as PGlite
      return await pg.transaction(async (t) => fn(wrapPgliteTx(t)))
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

async function withDsqlTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = await getDsql()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const out = await fn(wrapPgClient(client))
    await client.query("COMMIT")
    return out
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

function wrapPgliteTx(t: { query: PGlite["query"] }): Tx {
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

function wrapPgClient(client: PoolClient): Tx {
  return {
    async query<T>(sql: Sql, params: Params = []) {
      const res = await client.query(sql, params)
      return res.rows as T[]
    },
    async queryOne<T>(sql: Sql, params: Params = []) {
      const res = await client.query(sql, params)
      return (res.rows[0] as T) ?? null
    },
  }
}

/** Number coercion — PGlite returns NUMERIC columns as strings. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0
  return typeof v === "number" ? v : Number(v)
}
