// Shared backend contract. The public seam (index.ts) dispatches to one of these.

export type Sql = string
export type Params = unknown[]

/** The in-transaction handle (no nested module-level query/withTx — that
 *  deadlocks a single-connection backend). */
export interface Tx {
  query<T = Record<string, unknown>>(sql: Sql, params?: Params): Promise<T[]>
  queryOne<T = Record<string, unknown>>(sql: Sql, params?: Params): Promise<T | null>
}

/** A concrete data backend (PGlite or node-postgres). The public helpers in
 *  index.ts wrap these; nothing outside lib/db touches a Backend directly. */
export interface Backend {
  /** Resolves once the backend is connected, migrated, and (if empty) seeded. */
  ready: Promise<void>
  /** The raw underlying handle (PGlite | pg.Pool) — returned by getDb() for
   *  back-compat; callers only await it. */
  handle: unknown
  query<T = Record<string, unknown>>(sql: Sql, params: Params): Promise<T[]>
  withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
}

/** Minimal structural shape the seed needs — satisfied by both PGlite's and
 *  node-postgres' `query(sql, params) => { rows }`. */
export interface SeedConn {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}
