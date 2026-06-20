"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { EARNINGS_90D, RANGE_OPTIONS, type EarningsPoint, type RangeDays } from "@/lib/dashboard-data"
import { cn } from "@/lib/utils"

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: EarningsPoint }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      <p className="font-mono text-[11px] text-tertiary">{fmtDate(p.date)}</p>
      <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {p.myc.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">MYC</span>
      </p>
      {p.payout != null && (
        <p className="mt-0.5 font-mono text-[11px] text-accent">payout · {p.payout.toLocaleString()} MYC</p>
      )}
    </div>
  )
}

export function EarningsChart({ data = EARNINGS_90D }: { data?: EarningsPoint[] }) {
  const [days, setDays] = useState<RangeDays>(30)

  // Slice the trailing N days. History is loaded once; new points get
  // appended live at each epoch close (wire to the ledger stream).
  const view = useMemo(() => data.slice(-days), [data, days])
  const payouts = useMemo(() => view.filter((d) => d.payout != null), [view])
  const total = useMemo(() => view.reduce((s, d) => s + d.myc, 0), [view])

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Earnings</h2>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
            {total.toLocaleString()}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">MYC · {days}d</span>
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-border bg-secondary p-0.5" role="tablist" aria-label="Date range">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="tab"
              aria-selected={days === opt.days}
              onClick={() => setDays(opt.days)}
              className={cn(
                "rounded-md px-3 py-1 font-mono text-xs transition-colors",
                days === opt.days ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={view} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="earnings-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fill: "var(--color-tertiary)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              tick={{ fill: "var(--color-tertiary)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--color-border)" }} />
            <Area
              type="monotone"
              dataKey="myc"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#earnings-fill)"
              isAnimationActive={false}
            />
            {/* amber markers for payout events */}
            {payouts.map((p) => (
              <ReferenceDot
                key={p.date}
                x={p.date}
                y={p.myc}
                r={4}
                fill="var(--color-accent)"
                stroke="var(--color-background)"
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center gap-4 font-mono text-[11px] text-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" /> daily earnings
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent" /> payout settled
        </span>
      </div>
    </div>
  )
}
