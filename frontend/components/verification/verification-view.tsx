"use client"

import { ShieldCheck, ShieldX, Gauge, Coins, TrendingUp, TrendingDown, Crosshair, Lock } from "lucide-react"
import { usePoll } from "@/lib/api"
import { cn } from "@/lib/utils"

interface RefereeData {
  job: string
  tileIndex: number
  cheatRow: number
  agree: boolean
  divergentRow: number | null
  comparisons: number
  rowsRecomputed: number
  totalRows: number
  winner: string | null
  speedup: number
  convicted: string
}

function RefereeCard() {
  const { data } = usePoll<RefereeData>("/api/verify/referee", 4000)
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Crosshair className="size-4 text-primary" />
        <h2 className="text-sm font-medium text-foreground">Refereed-delegation recompute</h2>
        <span className="ml-auto font-mono text-[11px] text-tertiary">verification cost → logarithmic</span>
      </div>
      <p className="mb-3 max-w-3xl text-pretty text-[12px] text-muted-foreground">
        When two nodes disagree, the referee doesn&apos;t recompute the whole tile (the 2× replication tax). It treats
        the computation as a sequential trace, binary-searches to the <em>first divergent step</em>, and recomputes only
        that one step to convict the cheater — driving verification from O(n) toward O(log n).
      </p>
      {data && !data.agree ? (
        <div className="grid grid-cols-2 gap-3 font-mono text-[12px] sm:grid-cols-4">
          <Cell label="divergent row" value={`#${data.divergentRow}`} />
          <Cell label="binary-search steps" value={`${data.comparisons}`} sub={`~log₂(${data.totalRows})`} />
          <Cell label="rows recomputed" value={`${data.rowsRecomputed} / ${data.totalRows}`} sub="vs full recompute" tint="text-primary" />
          <Cell label="speedup" value={`${data.speedup}×`} tint="text-primary" />
          <div className="col-span-2 sm:col-span-4 rounded-xl border border-border bg-secondary/30 p-3 text-[12px]">
            <span className="text-tertiary">live challenge:</span>{" "}
            <span className="text-foreground">{data.job} · tile {data.tileIndex}</span> — referee convicted{" "}
            <span className="text-status-offline">{data.convicted}</span> at row {data.divergentRow}.
          </div>
        </div>
      ) : (
        <p className="font-mono text-[12px] text-tertiary">running a live challenge…</p>
      )}
    </div>
  )
}

interface SandboxData {
  benign: { ok: boolean; value: number; ms: number }
  denied: { denied: boolean; error: string; ms: number }
  runaway: { killed: boolean; ms: number }
}

function SandboxCard() {
  const { data } = usePoll<SandboxData>("/api/sandbox/demo", 6000)
  const Row = ({ pass, label, detail }: { pass: boolean; label: string; detail: string }) => (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3">
      {pass ? <ShieldCheck className="size-4 text-primary" /> : <ShieldX className="size-4 text-status-offline" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground">{label}</p>
        <p className="truncate font-mono text-[10px] text-tertiary">{detail}</p>
      </div>
    </div>
  )
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="size-4 text-primary" />
        <h2 className="text-sm font-medium text-foreground">Host protection · capability sandbox</h2>
        <span className="ml-auto font-mono text-[11px] text-tertiary">untrusted jobs run capability-denied + capped</span>
      </div>
      {data ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Row pass={data.benign.ok} label="Benign kernel runs" detail={`returned ${data.benign.value} in ${data.benign.ms}ms`} />
          <Row pass={data.denied.denied} label="Filesystem access denied" detail={data.denied.error || "no ambient authority"} />
          <Row pass={data.runaway.killed} label="Runaway loop killed" detail={`time cap hit at ${data.runaway.ms}ms`} />
        </div>
      ) : (
        <p className="font-mono text-[12px] text-tertiary">running sandbox checks…</p>
      )}
      <p className="mt-3 font-mono text-[10px] text-tertiary">
        Slice of the Wasmtime/WASI design (Firecracker/gVisor for native/GPU jobs) — capability model + resource caps.
      </p>
    </div>
  )
}

function Cell({ label, value, sub, tint }: { label: string; value: string; sub?: string; tint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-tertiary">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", tint ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

interface NodeRow {
  name: string
  reputation: number
  stake: number
  spotCheckRate: number
  failed: number
  checks: number
}
interface EconRow {
  label: string
  sellable: number
  kwh: number
  kwhLabel: string
  electricity: number
  gross: number
  fee: number
  receives: number
  net: number
}
interface VData {
  sellableFraction: number
  verificationTax: number
  avgReputation: number
  totalStake: number
  totalSlashed: number
  cheatsCaught: number
  spotChecks: number
  leaderboard: NodeRow[]
  flagged: NodeRow[]
  economics: { regimes: EconRow[] }
}

function Stat({ icon: Icon, label, value, unit, tint }: { icon: typeof Gauge; label: string; value: string; unit?: string; tint?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
      <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        <Icon className={cn("size-4", tint ?? "text-primary")} strokeWidth={1.75} /> {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className={cn("font-mono text-2xl font-semibold tabular-nums", tint ?? "text-foreground")}>{value}</span>
        {unit && <span className="font-mono text-[11px] text-tertiary">{unit}</span>}
      </span>
    </div>
  )
}

export function VerificationView() {
  const { data } = usePoll<VData>("/api/verification", 2500)

  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-6">
      <div>
        <h1 className="font-display text-balance text-3xl font-normal tracking-tight text-foreground">Trust &amp; economics</h1>
        <p className="mt-1 max-w-2xl text-pretty text-sm text-muted-foreground">
          The moat. A stake-weighted spot-check makes cheating negative-EV: a failed challenge slashes the node&apos;s
          stake and drops its reputation, which raises its sampling rate. Reputation drives the <em>sellable fraction</em> —
          the dominant term in the unit economics.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Gauge} label="Sellable fraction" value={data ? `${data.sellableFraction}` : "—"} unit="%" />
        <Stat icon={ShieldCheck} label="Verification tax" value={data ? `${data.verificationTax}` : "—"} unit="%" tint="text-accent" />
        <Stat icon={Coins} label="Stake at risk" value={data ? data.totalStake.toLocaleString() : "—"} unit="MYC" />
        <Stat icon={ShieldX} label="Cheats slashed" value={data ? `${data.cheatsCaught}` : "—"} unit={data ? `· −${data.totalSlashed} MYC` : ""} tint="text-status-offline" />
      </div>

      {/* unit economics — the §7 worked example, computed live against the current sellable fraction */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">Contributor unit economics (per node-hour, RTX 4070-class)</h2>
          <span className="ml-auto font-mono text-[11px] text-tertiary">requester $0.15/sellable GPU-h · 20% platform fee</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono text-[12px]">
            <thead>
              <tr className="text-tertiary">
                <th className="py-2 pr-4 font-normal">regime</th>
                <th className="py-2 pr-4 font-normal">electricity</th>
                <th className="py-2 pr-4 font-normal">requester gross</th>
                <th className="py-2 pr-4 font-normal">contributor receives</th>
                <th className="py-2 pr-4 font-normal">contributor NET</th>
              </tr>
            </thead>
            <tbody>
              {(data?.economics.regimes ?? []).map((r, i) => (
                <tr key={i} className="border-t border-border/60">
                  <td className="py-2 pr-4 text-muted-foreground">{r.label} · {r.kwhLabel}</td>
                  <td className="py-2 pr-4 tabular-nums text-foreground">${r.electricity.toFixed(3)}</td>
                  <td className="py-2 pr-4 tabular-nums text-foreground">${r.gross.toFixed(3)}</td>
                  <td className="py-2 pr-4 tabular-nums text-foreground">${r.receives.toFixed(3)}</td>
                  <td className={cn("py-2 pr-4 tabular-nums inline-flex items-center gap-1", r.net > 0 ? "text-primary" : "text-status-offline")}>
                    {r.net > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    {r.net >= 0 ? "+" : ""}${r.net.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-tertiary">
          The spread is positive in the GPU + cheap-power + proven-node regime and goes to zero/negative in high-kWh or
          unproven-node regimes — which is exactly why driving the sellable fraction up (better verification → less
          replication tax) is the whole business.
        </p>
      </div>

      {/* refereed-delegation recompute — logarithmic verification */}
      <RefereeCard />

      {/* host protection — capability sandbox for untrusted jobs */}
      <SandboxCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* reputation leaderboard */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium text-foreground">Proven nodes · low spot-check rate</h2>
          <NodeTable rows={data?.leaderboard ?? []} />
        </div>
        {/* flagged / slashed */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Flagged nodes · caught cheating</h2>
            <span className="font-mono text-[11px] text-tertiary">{data ? `${data.spotChecks.toLocaleString()} challenges run` : ""}</span>
          </div>
          {data && data.flagged.length === 0 ? (
            <p className="py-6 text-center font-mono text-[12px] text-tertiary">No cheats caught yet — watch the mesh.</p>
          ) : (
            <NodeTable rows={data?.flagged ?? []} danger />
          )}
        </div>
      </div>
    </div>
  )
}

function NodeTable({ rows, danger }: { rows: NodeRow[]; danger?: boolean }) {
  return (
    <table className="w-full border-collapse text-left font-mono text-[12px]">
      <thead>
        <tr className="text-tertiary">
          <th className="py-1.5 pr-3 font-normal">node</th>
          <th className="py-1.5 pr-3 font-normal">rep</th>
          <th className="py-1.5 pr-3 font-normal">stake</th>
          <th className="py-1.5 pr-3 font-normal">spot-check</th>
          {danger && <th className="py-1.5 pr-3 font-normal">failed</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((n) => (
          <tr key={n.name} className="border-t border-border/60">
            <td className="py-1.5 pr-3 text-foreground">{n.name}</td>
            <td className={cn("py-1.5 pr-3 tabular-nums", n.reputation >= 70 ? "text-primary" : n.reputation >= 40 ? "text-accent" : "text-status-offline")}>{n.reputation}</td>
            <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{n.stake}</td>
            <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{n.spotCheckRate}%</td>
            {danger && <td className="py-1.5 pr-3 tabular-nums text-status-offline">{n.failed}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
