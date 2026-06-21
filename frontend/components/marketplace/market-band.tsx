"use client"

import { TrendingUp, Activity } from "lucide-react"
import { usePoll, useNetwork } from "@/lib/api"

interface MarketResp {
  market: { supply: number; demand: number; clearingPrice: number }
}

export function MarketBand() {
  const { data } = usePoll<MarketResp>("/api/marketplace", 3000)
  const net = useNetwork()
  const supply = data?.market.supply ?? 0
  const demand = data?.market.demand ?? 0
  const total = Math.max(1, supply + demand)
  const supplyPct = Math.round((supply / total) * 100)
  const price = data?.market.clearingPrice ?? 0.12

  const cells: Array<{ label: string; value: string; unit?: string }> = [
    { label: "Supply", value: supply.toLocaleString(), unit: "units" },
    { label: "Demand", value: demand.toLocaleString(), unit: "units" },
    { label: "Clearing price", value: `${price}`, unit: "MYC/u" },
    { label: "Jobs running", value: `${net?.cluster.jobsRunning ?? 0}` },
    { label: "Queued", value: `${net?.cluster.jobsQueued ?? 0}` },
  ]

  return (
    <section aria-label="Market supply and demand" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <Activity className="size-4 text-primary" /> Market · supply vs demand
        </h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-tertiary">
          <span className="size-1.5 rounded-full bg-primary [animation:spore-pulse_2.4s_ease-in-out_infinite]" /> live
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-5">
        {cells.map((c) => (
          <div key={c.label} className="flex min-w-0 flex-col gap-1 px-4 py-3">
            <span className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</span>
            <span className="flex items-baseline gap-1">
              <span className="font-mono text-lg font-semibold tabular-nums text-foreground">{c.value}</span>
              {c.unit && <span className="font-mono text-[10px] text-tertiary">{c.unit}</span>}
            </span>
          </div>
        ))}
      </div>

      {/* supply/demand split bar */}
      <div className="px-5 pb-4">
        <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary/70" style={{ width: `${supplyPct}%` }} title={`supply ${supplyPct}%`} />
          <div className="h-full bg-accent/70" style={{ width: `${100 - supplyPct}%` }} title={`demand ${100 - supplyPct}%`} />
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-tertiary">
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-primary/70" /> supply {supplyPct}%</span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="size-3 text-primary" /> {supply >= demand ? "buyer's market — providers compete" : "demand-led — prices firm"}
          </span>
          <span className="inline-flex items-center gap-1">demand {100 - supplyPct}% <span className="size-2 rounded-full bg-accent/70" /></span>
        </div>
      </div>
    </section>
  )
}
