"use client"

import { Boxes, CircleDot } from "lucide-react"
import { usePoll } from "@/lib/api"
import { WORKLOADS } from "@/lib/workloads"
import { cn } from "@/lib/utils"

interface MC {
  pi: number
  error: number
  tasks: number
  verified: number
  rejected: number
  samples: number
}

export function WorkloadsPanel() {
  const { data } = usePoll<MC>("/api/montecarlo", 5000)
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
      {/* the registry — verification is per workload class */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Boxes className="size-4 text-primary" />
          <h2 className="text-sm font-medium text-foreground">Compute workloads</h2>
          <span className="ml-auto font-mono text-[11px] text-tertiary">verification is per-class</span>
        </div>
        <ul className="divide-y divide-border">
          {WORKLOADS.map((w) => (
            <li key={w.id} className="flex items-center gap-3 py-2.5">
              <CircleDot className={cn("size-3.5 shrink-0", w.status === "live" ? "text-primary" : "text-tertiary")} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground">{w.label}</p>
                <p className="truncate font-mono text-[10px] text-tertiary">verify: {w.verify}</p>
              </div>
              <span className={cn("rounded-md px-2 py-0.5 font-mono text-[10px]", w.status === "live" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>
                {w.status}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* a second LIVE verifiable workload: distributed Monte Carlo π */}
      <div className="flex flex-col rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Monte Carlo · π</h2>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-tertiary">
            <span className="size-1.5 rounded-full bg-primary [animation:spore-pulse_2.4s_ease-in-out_infinite]" /> live
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1">
          <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">{data ? data.pi.toFixed(5) : "—"}</span>
          <span className="font-mono text-[11px] text-tertiary">error {data ? data.error.toFixed(5) : "—"} vs π</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="flex flex-col"><span className="text-tertiary">verified</span><span className="tabular-nums text-primary">{data ? `${data.verified}/${data.tasks}` : "—"}</span></div>
          <div className="flex flex-col"><span className="text-tertiary">rejected</span><span className="tabular-nums text-status-offline">{data?.rejected ?? "—"}</span></div>
          <div className="flex flex-col"><span className="text-tertiary">samples</span><span className="tabular-nums text-foreground">{data ? `${Math.round(data.samples / 1000)}k` : "—"}</span></div>
        </div>
      </div>
    </div>
  )
}
