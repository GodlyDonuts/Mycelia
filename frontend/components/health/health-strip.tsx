"use client"

import { CheckCircle2, AlertTriangle, Activity, ShieldX } from "lucide-react"
import { usePoll } from "@/lib/api"
import { cn } from "@/lib/utils"

interface HealthData {
  render: { name: string; status: string; completed: number; total: number; tilesByStatus: Record<string, number> } | null
  training: { name: string; round: number; maxRounds: number; valLoss: number | null; status: string } | null
  mesh: { online: number; stale: number; real: number }
  trust: { cheatsCaught: number; totalSlashed: number; rejectsLast5m: number }
  reconciliation: { accountsChecked: number; negativeBalances: number; jobsChecked: number; overspentJobs: number; ok: boolean }
  workers: Array<{ name: string; status: string; heartbeatAgeSec: number | null }>
}

function Counter({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border p-4", danger ? "border-status-offline/40 bg-status-offline/5" : "border-border bg-secondary/30")}>
      <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary">{label}</span>
      <span className={cn("font-mono text-xl font-semibold tabular-nums", danger ? "text-status-offline" : "text-foreground")}>{value}</span>
      {sub && <span className="font-mono text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  )
}

export function HealthStrip() {
  const { data, error } = usePoll<HealthData>("/api/health", 1500)

  const recon = data?.reconciliation
  const tiles = data?.render?.tilesByStatus ?? {}

  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-balance text-3xl font-normal tracking-tight text-foreground">On-stage health</h1>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">Live operational counters — so we can see trouble, not guess (PLAN §9 runbook).</p>
        </div>
        <span className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[12px]",
          recon?.ok ? "border-primary/30 bg-primary/5 text-primary" : "border-status-offline/40 bg-status-offline/5 text-status-offline")}>
          {recon?.ok ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
          {error ? "feed error" : recon?.ok ? "all systems nominal" : "drift detected"}
        </span>
      </div>

      {/* reconciliation sweep */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h2 className="text-sm font-medium text-foreground">Ledger reconciliation sweep</h2>
          <span className={cn("ml-auto inline-flex items-center gap-1.5 font-mono text-[11px]", recon?.ok ? "text-primary" : "text-status-offline")}>
            {recon?.ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
            {recon?.ok ? "invariants hold" : "VIOLATION"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Counter label="accounts checked" value={`${recon?.accountsChecked ?? 0}`} />
          <Counter label="negative balances" value={`${recon?.negativeBalances ?? 0}`} danger={!!recon && recon.negativeBalances > 0} sub="overdraft guard" />
          <Counter label="jobs checked" value={`${recon?.jobsChecked ?? 0}`} />
          <Counter label="overspent jobs" value={`${recon?.overspentJobs ?? 0}`} danger={!!recon && recon.overspentJobs > 0} sub="escrow coverage" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* render */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium text-foreground">Render</h2>
          <p className="mb-3 truncate font-mono text-[11px] text-tertiary">{data?.render ? `${data.render.name} · ${data.render.status}` : "—"}</p>
          <div className="grid grid-cols-2 gap-3">
            <Counter label="verified" value={`${tiles.verified ?? 0}`} sub={`of ${data?.render?.total ?? 0}`} />
            <Counter label="pending" value={`${tiles.pending ?? 0}`} />
            <Counter label="claimed" value={`${tiles.claimed ?? 0}`} />
            <Counter label="failed" value={`${tiles.failed ?? 0}`} danger={(tiles.failed ?? 0) > 0} />
          </div>
        </div>

        {/* training */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium text-foreground">Training</h2>
          <p className="mb-3 truncate font-mono text-[11px] text-tertiary">{data?.training ? `${data.training.name} · ${data.training.status}` : "—"}</p>
          <div className="grid grid-cols-2 gap-3">
            <Counter label="round" value={data?.training ? `${data.training.round}/${data.training.maxRounds}` : "—"} />
            <Counter label="val loss" value={data?.training?.valLoss != null ? data.training.valLoss.toFixed(4) : "—"} />
          </div>
        </div>

        {/* mesh + trust */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium text-foreground">Mesh &amp; trust</h2>
          <div className="grid grid-cols-2 gap-3">
            <Counter label="nodes online" value={`${data?.mesh.online ?? 0}`} />
            <Counter label="stale (>45s)" value={`${data?.mesh.stale ?? 0}`} danger={(data?.mesh.stale ?? 0) > 3} />
            <Counter label="cheats slashed" value={`${data?.trust.cheatsCaught ?? 0}`} sub={`−${data?.trust.totalSlashed ?? 0} MYC`} />
            <Counter label="rejects (5m)" value={`${data?.trust.rejectsLast5m ?? 0}`} />
          </div>
        </div>
      </div>

      {/* real workers heartbeat */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-medium text-foreground">Real workers · last heartbeat</h2>
        {(!data || data.workers.length === 0) && <p className="font-mono text-[11px] text-tertiary">No real workers — open the Network page and Join the mesh.</p>}
        <div className="flex flex-wrap gap-2">
          {data?.workers.map((w) => {
            const stale = w.status === "offline" || (w.heartbeatAgeSec != null && w.heartbeatAgeSec > 45)
            return (
              <span key={w.name} className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px]",
                stale ? "border-status-offline/40 text-status-offline" : "border-primary/30 text-primary")}>
                {stale ? <ShieldX className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                {w.name}
                <span className="text-tertiary">{w.heartbeatAgeSec != null ? `${w.heartbeatAgeSec}s` : "—"}</span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
