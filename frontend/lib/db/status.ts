// Live data-layer telemetry — the single source of truth for "what backend is
// this process actually talking to, and how is the connection behaving."
//
// The whole AWS story is observable from here: which driver is active (PGlite
// vs Aurora DSQL vs Aurora PostgreSQL), the endpoint/region, IAM-token auth +
// expiry, TLS posture, keep-alive pings, and the SQLSTATE 40001 OCC retries that
// only a real distributed Postgres ever raises. The /api/cloud route serves this
// object verbatim and the Cloud console renders it. Parked on globalThis so the
// counters survive Next's dev HMR and are shared across route handlers.

export type DbDriverName = "pglite" | "dsql" | "postgres"
export type AuthMode = "iam-token" | "password" | "embedded"
export type TlsMode = "rds-ca" | "verify" | "no-verify" | "none"

export interface DbStatus {
  driver: DbDriverName
  /** Human label for the badge: "Aurora DSQL", "Aurora PostgreSQL", "PGlite (embedded)". */
  label: string
  /** True for the managed cloud databases (dsql, postgres). */
  cloud: boolean
  host: string | null
  region: string | null
  database: string | null
  authMode: AuthMode
  tls: TlsMode
  /** ONE pooled connection — the discipline DSQL's connection limits require. */
  poolMax: number
  connectedAt: number | null
  /** IAM token lifecycle (dsql only). */
  tokenIssuedAt: number | null
  tokenTtlSec: number | null
  tokenRefreshes: number
  /** ~4-min keep-alive so the cluster doesn't scale-to-zero mid-demo. */
  lastKeepAliveAt: number | null
  keepAlivePings: number
  /** Resilience counters. */
  retries40001: number
  queries: number
  txns: number
  lastLatencyMs: number | null
  avgLatencyMs: number | null
  bootstrappedAt: number | null
  seeded: boolean
  /** When the cloud driver is unreachable we fall back to PGlite so the demo
   *  never dies on camera; this records that it happened and why. */
  fallback: { active: boolean; from: DbDriverName | null; reason: string | null }
  error: string | null
}

function fresh(): DbStatus {
  return {
    driver: "pglite",
    label: "PGlite (embedded)",
    cloud: false,
    host: null,
    region: null,
    database: null,
    authMode: "embedded",
    tls: "none",
    poolMax: 1,
    connectedAt: null,
    tokenIssuedAt: null,
    tokenTtlSec: null,
    tokenRefreshes: 0,
    lastKeepAliveAt: null,
    keepAlivePings: 0,
    retries40001: 0,
    queries: 0,
    txns: 0,
    lastLatencyMs: null,
    avgLatencyMs: null,
    bootstrappedAt: null,
    seeded: false,
    fallback: { active: false, from: null, reason: null },
    error: null,
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __mycelia_db_status: DbStatus | undefined
}

function store(): DbStatus {
  return (globalThis.__mycelia_db_status ??= fresh())
}

/** Read-only snapshot for the API/UI. */
export function getDbStatus(): DbStatus {
  return { ...store(), fallback: { ...store().fallback } }
}

/** Set the identity of the active backend (called once on connect). */
export function setDbIdentity(p: Partial<DbStatus>): void {
  Object.assign(store(), p)
}

const now = () => Date.now()

export function markConnected(): void {
  store().connectedAt = now()
}

export function markBootstrapped(seeded: boolean): void {
  const s = store()
  s.bootstrappedAt = now()
  s.seeded = s.seeded || seeded
}

export function markToken(ttlSec: number, refresh = false): void {
  const s = store()
  s.tokenIssuedAt = now()
  s.tokenTtlSec = ttlSec
  s.authMode = "iam-token"
  if (refresh) s.tokenRefreshes++
}

export function markKeepAlive(): void {
  const s = store()
  s.lastKeepAliveAt = now()
  s.keepAlivePings++
}

export function markRetry40001(): void {
  store().retries40001++
}

// Exponential moving average keeps the latency readout stable without storing a
// window. ~16-sample smoothing.
const EWMA = 1 / 16
export function recordQuery(latencyMs: number, isTxn = false): void {
  const s = store()
  if (isTxn) s.txns++
  else s.queries++
  s.lastLatencyMs = Math.round(latencyMs * 100) / 100
  s.avgLatencyMs = s.avgLatencyMs == null ? s.lastLatencyMs : Math.round((s.avgLatencyMs * (1 - EWMA) + latencyMs * EWMA) * 100) / 100
}

export function markFallback(from: DbDriverName, reason: string): void {
  const s = store()
  s.fallback = { active: true, from, reason }
  s.error = reason
}

export function clearError(): void {
  store().error = null
}
