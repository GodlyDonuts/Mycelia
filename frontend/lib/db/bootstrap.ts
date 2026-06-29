// Shared migration + seed logic used by every backend.
//
// schema.sql is plain, FK-free Postgres (DSQL-compatible). PGlite can exec the
// whole file at once; a real wire backend (node-postgres → Aurora) runs the
// statements one at a time, which is also what DSQL requires (it won't accept
// several DDL statements inside one implicit transaction).

import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { SeedConn } from "./types"
import type { DbDriverName } from "./status"

export function loadSchemaSql(): string {
  return readFileSync(join(process.cwd(), "lib", "db", "schema.sql"), "utf8")
}

/** Split a multi-statement script into individual statements. Our schema has no
 *  function bodies / dollar-quoting / string literals containing ';', so a
 *  comment-stripped split on ';' is correct and keeps DSQL happy. */
export function splitStatements(sql: string): string[] {
  const noComments = sql
    .split("\n")
    .map((line) => {
      const i = line.indexOf("--")
      return i >= 0 ? line.slice(0, i) : line
    })
    .join("\n")
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

interface ApplyConn {
  query(sql: string, params?: unknown[]): Promise<unknown>
}

/**
 * Apply schema.sql one statement at a time (required for DSQL, which won't take
 * several DDL statements in one implicit transaction). On the `dsql` driver,
 * secondary indexes must be built with CREATE INDEX ASYNC — we rewrite them and
 * treat index creation as best-effort (a missing performance index never blocks
 * a demo), while letting table-creation errors surface.
 */
export async function applySchema(conn: ApplyConn, driver: DbDriverName): Promise<{ applied: number; skipped: number }> {
  let applied = 0
  let skipped = 0
  for (const raw of splitStatements(loadSchemaSql())) {
    const isIndex = /^CREATE\s+INDEX/i.test(raw)
    const stmt =
      driver === "dsql" && isIndex
        ? raw.replace(/^CREATE\s+INDEX\s+(IF\s+NOT\s+EXISTS\s+)?/i, "CREATE INDEX ASYNC ")
        : raw
    try {
      await conn.query(stmt)
      applied++
    } catch (err) {
      // Tolerate index quirks (already-exists, unsupported ordering, async build
      // races); never swallow a failed table/constraint.
      const msg = err instanceof Error ? err.message : String(err)
      if (isIndex || /already exists/i.test(msg)) {
        skipped++
        console.warn(`[mycelia] schema: skipped statement — ${msg}`)
        continue
      }
      throw err
    }
  }
  return { applied, skipped }
}

/** Seed only when the mesh is empty, so a restart paints a populated app but an
 *  already-provisioned cloud DB is never double-seeded. Returns true if it
 *  actually seeded. Honors MYCELIA_DB_SEED=false to skip (prod). */
export async function seedIfEmpty(conn: SeedConn): Promise<boolean> {
  if (process.env.MYCELIA_DB_SEED === "false") return false
  const { rows } = await conn.query<{ n: number }>("SELECT count(*)::int AS n FROM nodes")
  if ((rows[0]?.n ?? 0) > 0) return false
  const { seed } = await import("./seed")
  await seed(conn)
  return true
}
