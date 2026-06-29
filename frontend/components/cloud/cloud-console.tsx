"use client"

// The AWS-integration console — the screenshot-able proof that the app is bound
// to a real managed database, plus the live connection telemetry that only a
// genuine wire backend produces: IAM-token auth + expiry, RDS-CA TLS, the ~4-min
// keep-alive against scale-to-zero, and the SQLSTATE 40001 OCC retries.

import { useEffect, useState } from "react"
import { Cloud, Database, KeyRound, ShieldCheck, Activity, RefreshCw, Server, CheckCircle2, AlertTriangle, Lock } from "lucide-react"
import { usePoll } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { DbStatus } from "@/lib/db"
import { ArchitectureDiagram } from "./architecture-diagram"

type CloudData = DbStatus & { serverNow: number }

function useNow(ms = 1000): number {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return Date.now()
}

function Field({ label, value, mono = true, accent }: { label: string; value: React.ReactNode; mono?: boolean; accent?: "teal" | "amber" | "danger" }) {
  const color = accent === "teal" ? "text-primary" : accent === "amber" ? "text-status-idle" : accent === "danger" ? "text-status-offline" : "text-foreground"
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="font-mono text-[11px] uppercase tracking-wider text-tertiary">{label}</span>
      <span className={cn("truncate text-right text-[13px]", mono && "font-mono tabular-nums", color)}>{value}</span>
    </div>
  )
}

function Card({ icon: Icon, title, children, right }: { icon: typeof Cloud; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-primary" strokeWidth={1.75} />
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {children}
    </div>
  )
}

function fmtAge(ms: number | null): string {
  if (ms == null) return "—"
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 90) return `${s}s ago`
  return `${Math.round(s / 60)}m ago`
}

export function CloudConsole() {
  const { data, error } = usePoll<CloudData>("/api/cloud", 2000)
  const now = useNow(1000)
  // Stamp when each frame arrived so countdowns/ages track the server clock
  // rather than drifting with local time.
  const [recvAt, setRecvAt] = useState(0)
  useEffect(() => {
    if (data) setRecvAt(Date.now())
  }, [data])
  const skew = data && recvAt ? data.serverNow - recvAt : 0

  const cloud = !!data?.cloud
  const fallback = !!data?.fallback.active
  const serverNow = now + skew

  const tokenRemaining =
    data?.tokenIssuedAt && data?.tokenTtlSec ? Math.max(0, Math.round((data.tokenIssuedAt + data.tokenTtlSec * 1000 - serverNow) / 1000)) : null
  const keepAliveAge = data?.lastKeepAliveAt ? serverNow - data.lastKeepAliveAt : null

  const state = error ? "error" : fallback ? "fallback" : cloud ? "connected" : "embedded"
  const statePill =
    state === "connected"
      ? { cls: "border-primary/30 bg-primary/5 text-primary", icon: CheckCircle2, text: "connected · live" }
      : state === "fallback"
        ? { cls: "border-status-idle/40 bg-status-idle/5 text-status-idle", icon: AlertTriangle, text: "cloud unreachable · PGlite fallback" }
        : state === "error"
          ? { cls: "border-status-offline/40 bg-status-offline/5 text-status-offline", icon: AlertTriangle, text: "feed error" }
          : { cls: "border-border bg-secondary/40 text-muted-foreground", icon: Database, text: "embedded (local)" }
  const PillIcon = statePill.icon

  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className={cn("flex size-12 items-center justify-center rounded-2xl border", cloud && !fallback ? "border-primary/30 bg-primary/10" : "border-status-idle/30 bg-status-idle/10")}>
            <Database className={cn("size-6", cloud && !fallback ? "text-primary" : "text-status-idle")} strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-normal tracking-tight text-foreground">{data?.label ?? "Resolving backend…"}</h1>
            <p className="font-mono text-[11px] text-tertiary">
              MYCELIA_DB_DRIVER={data?.driver ?? "…"} · the one-file seam · lib/db/index.ts
            </p>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[12px]", statePill.cls)}>
          <PillIcon className="size-4" />
          {statePill.text}
        </span>
      </div>

      {fallback && (
        <div className="rounded-xl border border-status-idle/40 bg-status-idle/5 px-4 py-3 text-[13px] text-status-idle">
          <span className="font-medium">Cloud backend unreachable — running on the embedded fallback so the demo stays live.</span>
          <span className="mt-1 block font-mono text-[11px] text-muted-foreground">reason: {data?.fallback.reason}</span>
        </div>
      )}

      {/* architecture */}
      <ArchitectureDiagram status={data ?? null} />

      {/* telemetry grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card icon={Server} title="Connection">
          <Field label="endpoint" value={data?.host ?? "—"} />
          <Field label="region" value={data?.region ?? "—"} accent={cloud ? "teal" : undefined} />
          <Field label="database" value={data?.database ?? "—"} />
          <Field label="pool max" value={`${data?.poolMax ?? 1} (single connection)`} />
        </Card>

        <Card icon={KeyRound} title="Auth & TLS" right={
          <span className={cn("inline-flex items-center gap-1 font-mono text-[10px]", data?.authMode === "iam-token" ? "text-primary" : "text-tertiary")}>
            <Lock className="size-3" />{data?.authMode ?? "—"}
          </span>
        }>
          <Field label="auth mode" value={data?.authMode ?? "—"} accent={data?.authMode === "iam-token" ? "teal" : undefined} />
          <Field
            label="iam token"
            value={tokenRemaining != null ? `expires in ${Math.floor(tokenRemaining / 60)}m ${tokenRemaining % 60}s` : "n/a"}
            accent={tokenRemaining != null && tokenRemaining < 120 ? "amber" : tokenRemaining != null ? "teal" : undefined}
          />
          <Field label="token refreshes" value={`${data?.tokenRefreshes ?? 0}`} />
          <Field label="tls" value={data?.tls ?? "—"} accent={data?.tls === "rds-ca" || data?.tls === "verify" ? "teal" : data?.tls === "no-verify" ? "amber" : undefined} />
        </Card>

        <Card icon={RefreshCw} title="Keep-alive" right={
          <span className="font-mono text-[10px] text-tertiary">{data?.keepAlivePings ?? 0} pings</span>
        }>
          <Field label="last ping" value={fmtAge(keepAliveAge)} accent={keepAliveAge != null && keepAliveAge < 5 * 60 * 1000 ? "teal" : undefined} />
          <Field label="interval" value="~4 min (anti scale-to-zero)" mono={false} />
          <Field label="connected" value={fmtAge(data?.connectedAt ? serverNow - data.connectedAt : null)} />
          <Field label="bootstrapped" value={data?.bootstrappedAt ? "yes" : "pending"} accent={data?.bootstrappedAt ? "teal" : undefined} />
        </Card>

        <Card icon={Activity} title="Throughput">
          <Field label="queries" value={(data?.queries ?? 0).toLocaleString()} accent="teal" />
          <Field label="transactions" value={(data?.txns ?? 0).toLocaleString()} />
          <Field label="last latency" value={data?.lastLatencyMs != null ? `${data.lastLatencyMs} ms` : "—"} />
          <Field label="avg latency" value={data?.avgLatencyMs != null ? `${data.avgLatencyMs} ms` : "—"} />
        </Card>

        <Card icon={ShieldCheck} title="OCC resilience">
          <Field label="40001 retries" value={`${data?.retries40001 ?? 0}`} accent={(data?.retries40001 ?? 0) > 0 ? "amber" : "teal"} />
          <Field label="conflict policy" value="retry w/ backoff ×5" mono={false} />
          <Field label="serialization" value="account_balance UPDATE" />
          <Field label="seeded" value={data?.seeded ? "yes" : "no"} />
        </Card>

        <Card icon={Cloud} title="Hackathon proof">
          <Field label="aws database" value={cloud && !fallback ? data?.label : "not bound"} accent={cloud && !fallback ? "teal" : "amber"} />
          <Field label="vercel frontend" value="Next.js 16 · App Router" mono={false} />
          <Field label="data model" value="FK-free · in-app integrity" mono={false} />
          <Field label="screenshot" value="console + this panel" mono={false} />
        </Card>
      </div>
    </div>
  )
}
