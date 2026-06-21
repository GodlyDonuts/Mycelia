"use client"

import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePoll } from "@/lib/api"
import type { StatCardData } from "@/lib/dashboard-data"

function Sparkline({ data, positive }: { data: StatCardData["spark"]; positive: boolean }) {
  const stroke = positive ? "var(--color-primary)" : "var(--color-tertiary)"
  const gid = `spark-${positive ? "up" : "flat"}`
  return (
    <div className="h-10 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#${gid})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StatCard({ stat }: { stat: StatCardData }) {
  const up = stat.delta > 0
  const down = stat.delta < 0
  const DeltaIcon = up ? TrendingUp : down ? TrendingDown : Minus

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{stat.label}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
            up && "bg-primary/10 text-primary",
            down && "bg-destructive/10 text-destructive",
            !up && !down && "bg-secondary text-muted-foreground",
          )}
        >
          <DeltaIcon className="size-3" />
          {up ? "+" : ""}
          {stat.delta.toFixed(1)}%
        </span>
      </div>

      <div className="mt-3">
        <p className="font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {stat.value}
        </p>
        {stat.sub && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{stat.sub}</p>}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-mono text-[11px] text-tertiary">{stat.deltaLabel}</span>
        <div className="w-24 sm:w-28">
          <Sparkline data={stat.spark} positive={!down} />
        </div>
      </div>
    </div>
  )
}

type DashboardStats = {
  totalEarnings: number
  totalEarningsUsd: number
  activeNodes: number
  enrolledNodes: number
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US")

export function StatCardRow({ stats }: { stats: StatCardData[] }) {
  // Live aggregate metrics from the read API. The "Total Earnings" and
  // "Active Nodes" cards take real values; the others stay cosmetic. Sparklines
  // + delta UI are preserved. Falls back to the passed mock `stats` until the
  // first frame loads so SSR + first paint render unchanged.
  const { data } = usePoll<DashboardStats>("/api/dashboard", 2000)

  const live = data
    ? stats.map((stat) => {
        if (stat.id === "earnings") {
          return {
            ...stat,
            value: `${fmt(data.totalEarnings)} MYC`,
            sub: `≈ $${fmt(data.totalEarningsUsd)} USD`,
          }
        }
        if (stat.id === "nodes") {
          return {
            ...stat,
            value: `${data.activeNodes}`,
            sub: `of ${data.enrolledNodes} enrolled`,
          }
        }
        return stat
      })
    : stats

  return (
    <section aria-label="Account summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {live.map((stat) => (
        <StatCard key={stat.id} stat={stat} />
      ))}
    </section>
  )
}
