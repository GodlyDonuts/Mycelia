"use client"

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ShieldX, Download } from "lucide-react"
import { usePoll } from "@/lib/api"

interface TrainingData {
  jobId: string
  name: string
  baseModel: string
  rank: number
  round: number
  maxRounds: number
  valLoss: number | null
  status: string
  rejectedDeltas: number
  loss: Array<{ round: number; loss: number | null }>
  contributions: Array<{ node: string; share: number; reward: number }>
}

function LossTooltip({ active, payload }: { active?: boolean; payload?: { payload: { round: number; loss: number } }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      <p className="font-mono text-[11px] text-tertiary">round {p.round}</p>
      <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {p.loss.toFixed(4)} <span className="text-xs font-normal text-muted-foreground">val loss</span>
      </p>
    </div>
  )
}

export function TrainingPanel() {
  const { data } = usePoll<TrainingData>("/api/training/active", 1500)
  const history = (data?.loss ?? []).filter((p): p is { round: number; loss: number } => p.loss != null)
  const contrib = data?.contributions ?? []
  const current = data?.valLoss

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Distributed Training</h2>
          <p className="truncate font-mono text-[11px] text-tertiary">
            {data ? `${data.baseModel} · LoRA r${data.rank} · round ${data.round}/${data.maxRounds}` : "LoRA · DiLoCo"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <a
              href={`/api/training/adapter?jobId=${data.jobId}`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              title="Download the trained LoRA adapter"
            >
              <Download className="size-3.5" /> adapter
            </a>
          )}
          {data && data.rejectedDeltas > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-status-offline/10 px-2 py-1 font-mono text-[11px] text-status-offline" title="bad deltas rejected by the canary-loss check">
              <ShieldX className="size-3.5" /> {data.rejectedDeltas} Δ rejected
            </span>
          )}
          <div className="text-right">
            <p className="font-mono text-[11px] text-tertiary">val loss</p>
            <p className="font-mono text-lg font-semibold tabular-nums text-primary">{current != null ? current.toFixed(4) : "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* loss curve — real validation loss dropping round-by-round */}
        <div className="h-48 w-full lg:h-full">
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="round" tick={{ fill: "var(--color-tertiary)", fontSize: 11, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis domain={[0, "auto"]} tick={{ fill: "var(--color-tertiary)", fontSize: 11, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<LossTooltip />} cursor={{ stroke: "var(--color-border)" }} />
                <Line type="monotone" dataKey="loss" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 2, fill: "var(--color-primary)" }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-[11px] text-tertiary">forming cells · dispatching round 0…</div>
          )}
        </div>

        {/* per-node contribution bars — token-weighted (heterogeneity made visible) */}
        <div className="flex flex-col justify-center gap-2.5">
          <p className="font-mono text-[11px] text-tertiary">contribution · tokens & MYC</p>
          {contrib.length === 0 && <p className="font-mono text-[11px] text-tertiary/70">awaiting accepted deltas…</p>}
          {contrib.map((c) => (
            <div key={c.node} className="flex flex-col gap-1">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="truncate text-muted-foreground">{c.node}</span>
                <span className="tabular-nums text-foreground">{Math.round(c.share * 100)}% · <span className="text-accent">{c.reward} MYC</span></span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${c.share * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <CommFooter />
    </div>
  )
}

function CommFooter() {
  const { data } = usePoll<{ method: string; adapters: Array<{ label: string; ratio: number }> }>("/api/training/comms", 30000)
  const lora = data?.adapters?.find((a) => a.label.startsWith("LoRA"))
  return (
    <p className="mt-3 border-t border-border pt-2 font-mono text-[10px] text-tertiary">
      comm: top-k + int8 + error-feedback{lora ? ` · adapter Δ ~${lora.ratio}× smaller over the WAN` : ""} (convergence preserved)
    </p>
  )
}
