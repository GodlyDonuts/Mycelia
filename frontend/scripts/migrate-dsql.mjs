import { DsqlSigner } from "@aws-sdk/dsql-signer"
import { loadEnvConfig } from "@next/env"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import pg from "pg"

loadEnvConfig(process.cwd())

const { Pool } = pg

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function normalizeHost(value) {
  return value.replace(/^postgres(?:ql)?:\/\//, "").replace(/^https?:\/\//, "").split(/[/:]/)[0]
}

const hostname = normalizeHost(requireEnv("DSQL_ENDPOINT"))
const region = requireEnv("AWS_REGION")
const signer = new DsqlSigner({ hostname, region, expiresIn: 900 })
const password = process.env.DSQL_USE_ADMIN_TOKEN === "false"
  ? await signer.getDbConnectAuthToken()
  : await signer.getDbConnectAdminAuthToken()

const pool = new Pool({
  host: hostname,
  port: Number(process.env.DSQL_PORT ?? 5432),
  database: process.env.DSQL_DATABASE ?? "postgres",
  user: process.env.DSQL_USER ?? "admin",
  password,
  max: 1,
  ssl: { ca: readFileSync(requireEnv("DSQL_CA_BUNDLE"), "utf8"), rejectUnauthorized: true },
})

try {
  const schema = readFileSync(join(process.cwd(), "lib", "db", "schema.sql"), "utf8")
  await pool.query(schema)
  console.log("Applied lib/db/schema.sql to Aurora DSQL")
} finally {
  await pool.end()
}
