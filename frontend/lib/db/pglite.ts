// PGlite backend — embedded Postgres-in-WASM. The default local/dev/test driver
// and the always-available fallback if a cloud connection can't be established.
// Single-writer, so it never raises SQLSTATE 40001; the retry wrapper is kept so
// the contract is identical to the wire backends.

import { PGlite } from "@electric-sql/pglite"
import type { Backend, Tx, Params, Sql } from "./types"
import { loadSchemaSql, seedIfEmpty } from "./bootstrap"
import { setDbIdentity, markConnected, markBootstrapped } from "./status"

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

export function createPgliteBackend(): Backend {
  const dir = process.env.MYCELIA_DB_DIR // optional persistence; defaults to in-memory
  const pg = dir ? new PGlite(dir) : new PGlite()

  setDbIdentity({
    driver: "pglite",
    label: dir ? "PGlite (persisted)" : "PGlite (embedded)",
    cloud: false,
    host: dir ?? "in-memory",
    region: "local",
    database: "postgres",
    authMode: "embedded",
    tls: "none",
    poolMax: 1,
  })

  const ready = (async () => {
    await pg.exec(loadSchemaSql())
    markConnected()
    const seeded = await seedIfEmpty(pg)
    markBootstrapped(seeded)
  })()

  return {
    ready,
    handle: pg,
    async query<T>(sql: Sql, params: Params) {
      const res = await pg.query<T>(sql, params)
      return res.rows
    },
    async withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return pg.transaction(async (t) => fn(wrapTx(t)))
    },
  }
}
