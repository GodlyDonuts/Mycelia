#!/usr/bin/env node
// Provision the schema on a real AWS database and report what's there.
//
//   MYCELIA_DB_DRIVER=dsql      DSQL_ENDPOINT=… AWS_REGION=…   pnpm db:setup
//   MYCELIA_DB_DRIVER=postgres  DATABASE_URL=postgres://…      pnpm db:setup
//
// Reads frontend/.env.local automatically. Idempotent (CREATE … IF NOT EXISTS),
// so it's safe to re-run. The app also auto-migrates + seeds on first request;
// this script exists so you can migrate explicitly and grab a console/terminal
// screenshot that proves the AWS database is live.

import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

// --- tiny .env.local loader (no dependency) --------------------------------
function loadEnv() {
  const p = join(root, ".env.local")
  if (!existsSync(p)) return
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const [, k, vRaw] = m
    if (process.env[k] != null) continue
    process.env[k] = vRaw.replace(/^["']|["']$/g, "")
  }
}
loadEnv()

const driver = (process.env.MYCELIA_DB_DRIVER || "").toLowerCase()
if (driver !== "dsql" && driver !== "postgres") {
  console.error("Set MYCELIA_DB_DRIVER=dsql or =postgres (this script targets a real AWS database).")
  console.error("PGlite (the default local driver) needs no setup — it migrates + seeds itself in-process.")
  process.exit(1)
}

function splitStatements(sql) {
  const noComments = sql
    .split("\n")
    .map((l) => {
      const i = l.indexOf("--")
      return i >= 0 ? l.slice(0, i) : l
    })
    .join("\n")
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
}

async function buildSsl() {
  const caPath = process.env.DSQL_CA_BUNDLE || process.env.DATABASE_CA_BUNDLE
  if (caPath) return { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true }
  const mode = (process.env.DATABASE_SSL || "").toLowerCase()
  if (mode === "disable" || mode === "off") return false
  if (mode === "no-verify") return { rejectUnauthorized: false }
  return { rejectUnauthorized: true }
}

async function makePool() {
  const { default: pg } = await import("pg")
  const ssl = await buildSsl()
  if (driver === "dsql") {
    const host = process.env.DSQL_ENDPOINT
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION
    if (!host || !region) throw new Error("dsql needs DSQL_ENDPOINT and AWS_REGION")
    const { DsqlSigner } = await import("@aws-sdk/dsql-signer")
    const user = process.env.DSQL_USER || "admin"
    const signer = new DsqlSigner({ hostname: host, region })
    const token = user === "admin" ? await signer.getDbConnectAdminAuthToken() : await signer.getDbConnectAuthToken()
    console.log(`• minted IAM auth token for ${user}@${host} (${region})`)
    return new pg.Pool({ host, port: 5432, database: process.env.DSQL_DATABASE || "postgres", user, password: token, ssl, max: 1 })
  }
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("postgres needs DATABASE_URL")
  return new pg.Pool({ connectionString: url, ssl, max: 1 })
}

const main = async () => {
  console.log(`\n▸ Mycelia db:setup — driver=${driver}\n`)
  const pool = await makePool()
  const t0 = Date.now()
  await pool.query("SELECT 1")
  console.log(`• connected in ${Date.now() - t0}ms`)

  const schema = readFileSync(join(root, "lib", "db", "schema.sql"), "utf8")
  const stmts = splitStatements(schema)
  let applied = 0
  let skipped = 0
  for (const raw of stmts) {
    const isIndex = /^CREATE\s+INDEX/i.test(raw)
    // DSQL builds secondary indexes asynchronously; plain CREATE INDEX errors.
    const s = driver === "dsql" && isIndex ? raw.replace(/^CREATE\s+INDEX\s+(IF\s+NOT\s+EXISTS\s+)?/i, "CREATE INDEX ASYNC ") : raw
    try {
      await pool.query(s)
      applied++
    } catch (e) {
      if (isIndex || /already exists/i.test(e.message)) {
        skipped++
        continue
      }
      throw e
    }
  }
  console.log(`• applied ${applied} schema statements${skipped ? ` (${skipped} index stmts skipped — best-effort)` : ""}`)

  const { rows: tables } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  )
  console.log(`\n  tables (${tables.length}):`)
  for (const { tablename } of tables) {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${tablename}`)
    console.log(`    ${tablename.padEnd(26)} ${rows[0].n} rows`)
  }
  console.log(`\n✓ schema live on ${driver === "dsql" ? "Aurora DSQL" : "the target Postgres"}.`)
  console.log(`  The app seeds a populated mesh on first request (set MYCELIA_DB_SEED=false to skip).\n`)
  await pool.end()
}

main().catch((e) => {
  console.error("\n✗ db:setup failed:", e.message)
  process.exit(1)
})
