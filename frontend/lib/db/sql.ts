// Wire backend — node-postgres against a real managed Postgres.
//
//   MYCELIA_DB_DRIVER=dsql      → Aurora DSQL: IAM-token auth (no static
//                                 password), Amazon RDS CA TLS, ~4-min keep-alive
//                                 so the serverless cluster doesn't scale to zero,
//                                 and the SQLSTATE 40001 OCC retry the OCC engine
//                                 actually exercises under contention.
//   MYCELIA_DB_DRIVER=postgres  → Aurora PostgreSQL / RDS / any DATABASE_URL.
//
// ONE pooled connection (max:1) — DSQL connection limits + the app's serialization
// discipline. `pg` and `@aws-sdk/dsql-signer` are imported dynamically so the
// PGlite-only path never loads them.

import type { Backend, Tx, Params, Sql } from "./types"
import { applySchema, seedIfEmpty } from "./bootstrap"
import {
  setDbIdentity,
  markConnected,
  markBootstrapped,
  markToken,
  markKeepAlive,
  clearError,
  type DbDriverName,
  type TlsMode,
} from "./status"

// node-postgres has no first-party ESM types here; treat loosely.
/* eslint-disable @typescript-eslint/no-explicit-any */
type PgPool = any

const TOKEN_TTL_SEC = 15 * 60 // DSQL IAM tokens are ~15 min
const KEEPALIVE_MS = 4 * 60 * 1000

declare global {
  // eslint-disable-next-line no-var
  var __mycelia_keepalive: ReturnType<typeof setInterval> | undefined
}

interface SslConfig {
  ssl: any
  tls: TlsMode
}

async function buildSsl(driver: DbDriverName): Promise<SslConfig> {
  const { readFileSync } = await import("node:fs")
  const caPath = process.env.DSQL_CA_BUNDLE || process.env.DATABASE_CA_BUNDLE
  if (caPath) {
    return { ssl: { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true }, tls: "rds-ca" }
  }
  const mode = (process.env.DATABASE_SSL || "").toLowerCase()
  if (mode === "disable" || mode === "off") return { ssl: false, tls: "none" }
  if (mode === "no-verify") return { ssl: { rejectUnauthorized: false }, tls: "no-verify" }
  // DSQL always needs TLS; default to verified against the system trust store.
  if (driver === "dsql") return { ssl: { rejectUnauthorized: true }, tls: "verify" }
  // Generic Postgres: TLS on by default (Aurora/RDS/Neon require it); relax only
  // if the operator opts out above.
  return { ssl: { rejectUnauthorized: true }, tls: "verify" }
}

async function makePool(driver: DbDriverName): Promise<{ pool: PgPool; host: string; database: string; region: string | null }> {
  const { Pool } = (await import("pg")) as any
  const { ssl, tls } = await buildSsl(driver)

  if (driver === "dsql") {
    const host = process.env.DSQL_ENDPOINT
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || null
    if (!host) throw new Error("DSQL_ENDPOINT is required for MYCELIA_DB_DRIVER=dsql")
    if (!region) throw new Error("AWS_REGION is required for MYCELIA_DB_DRIVER=dsql")
    const { DsqlSigner } = (await import("@aws-sdk/dsql-signer")) as any
    const user = process.env.DSQL_USER || "admin"
    const signer = new DsqlSigner({ hostname: host, region })
    const mintToken = async (refresh = false): Promise<string> => {
      const token =
        user === "admin"
          ? await signer.getDbConnectAdminAuthToken()
          : await signer.getDbConnectAuthToken()
      markToken(TOKEN_TTL_SEC, refresh)
      return token
    }
    // Eager mint populates the token telemetry; the function form lets pg refresh
    // automatically whenever it opens a new physical connection.
    await mintToken(false)
    let first = true
    const pool = new Pool({
      host,
      port: Number(process.env.DSQL_PORT || 5432),
      database: process.env.DSQL_DATABASE || "postgres",
      user,
      password: async () => {
        const t = await mintToken(!first)
        first = false
        return t
      },
      max: 1,
      ssl,
      idleTimeoutMillis: 0,
      keepAlive: true,
    })
    setDbIdentity({
      driver,
      label: "Aurora DSQL",
      cloud: true,
      host,
      region,
      database: process.env.DSQL_DATABASE || "postgres",
      authMode: "iam-token",
      tls,
      poolMax: 1,
    })
    return { pool, host, database: process.env.DSQL_DATABASE || "postgres", region }
  }

  // Generic Postgres (Aurora PostgreSQL / RDS / Neon / local).
  const url = process.env.DATABASE_URL
  const region = process.env.AWS_REGION || null
  const cfg: any = url
    ? { connectionString: url, max: 1, ssl }
    : {
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || "postgres",
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        max: 1,
        ssl,
      }
  if (!url && !cfg.host) throw new Error("DATABASE_URL (or PGHOST/PGUSER/…) is required for MYCELIA_DB_DRIVER=postgres")
  const pool = new Pool(cfg)
  // Derive a display host without leaking the password.
  let host = cfg.host || "postgres"
  let database = cfg.database || "postgres"
  if (url) {
    try {
      const u = new URL(url)
      host = u.hostname
      database = u.pathname.replace(/^\//, "") || "postgres"
    } catch {
      /* keep defaults */
    }
  }
  const isAurora = /\.rds\.amazonaws\.com$|\.cluster-.*\.rds\.amazonaws\.com$|amazonaws\.com$/.test(host)
  setDbIdentity({
    driver,
    label: isAurora ? "Aurora PostgreSQL" : "PostgreSQL",
    cloud: true,
    host,
    region,
    database,
    authMode: "password",
    tls,
    poolMax: 1,
  })
  return { pool, host, database, region }
}

function startKeepAlive(pool: PgPool): void {
  if (globalThis.__mycelia_keepalive) return
  globalThis.__mycelia_keepalive = setInterval(() => {
    pool
      .query("SELECT 1")
      .then(() => markKeepAlive())
      .catch(() => {
        /* a failed keep-alive is surfaced by the next real query */
      })
  }, KEEPALIVE_MS)
  // Don't keep the process alive solely for the heartbeat.
  ;(globalThis.__mycelia_keepalive as any)?.unref?.()
}

export async function createSqlBackend(driver: DbDriverName): Promise<Backend> {
  const { pool } = await makePool(driver)

  const ready = (async () => {
    // Prove the connection (and mint/validate the token) before bootstrapping.
    await pool.query("SELECT 1")
    markConnected()
    clearError()
    await applySchema({ query: (sql, params) => pool.query(sql, params) }, driver)
    const seeded = await seedIfEmpty({
      query: async (sql: string, params: unknown[] = []) => pool.query(sql, params),
    })
    markBootstrapped(seeded)
    startKeepAlive(pool)
  })()

  return {
    ready,
    handle: pool,
    async query<T>(sql: Sql, params: Params) {
      const res = await pool.query(sql, params)
      return res.rows as T[]
    },
    // ONE transaction attempt — the 40001 retry-with-backoff is centralized in
    // the public withTx (lib/db/index.ts) so it's identical across backends.
    async withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      const c = await pool.connect()
      try {
        await c.query("BEGIN")
        const tx: Tx = {
          async query<R>(sql: Sql, params: Params = []) {
            const res = await c.query(sql, params)
            return res.rows as R[]
          },
          async queryOne<R>(sql: Sql, params: Params = []) {
            const res = await c.query(sql, params)
            return (res.rows[0] as R) ?? null
          },
        }
        const out = await fn(tx)
        await c.query("COMMIT")
        return out
      } catch (err) {
        await c.query("ROLLBACK").catch(() => {})
        throw err
      } finally {
        c.release()
      }
    },
  }
}
