"use client"

import { useEffect, useState } from "react"
import { useCountUp } from "@/hooks/use-count-up"

export type LiveStat = {
  label: string
  value: number
  decimals?: number
  suffix?: string
  jitter: number
}

// NOTE: placeholder values. Wire to the live telemetry stream (SSE from the
// scheduler) where marked below.
const DEFAULT_STATS: LiveStat[] = [
  { label: "Active nodes", value: 1284530, jitter: 240 },
  { label: "GPUs online", value: 342118, jitter: 90 },
  { label: "Network TFLOP/s", value: 8472.6, decimals: 1, jitter: 12 },
  { label: "Jobs running", value: 9417, jitter: 18 },
]

function format(n: number, decimals = 0) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function StatItem({ stat, live }: { stat: LiveStat; live: number }) {
  const { ref, value } = useCountUp(stat.value)
  const display = value >= stat.value * 0.999 ? live : value

  return (
    <div className="flex flex-col gap-2 px-2 py-10 text-center">
      <span
        ref={ref}
        className="font-mono text-3xl tracking-tight text-foreground tabular-nums sm:text-[2.5rem]"
      >
        {format(display, stat.decimals)}
        {stat.suffix ?? ""}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-tertiary">
        {stat.label}
      </span>
    </div>
  )
}

export function StatsBand({ stats = DEFAULT_STATS }: { stats?: LiveStat[] }) {
  const [live, setLive] = useState(() => stats.map((s) => s.value))

  useEffect(() => {
    // Placeholder polling. Replace with a subscription to the live metrics feed.
    const id = setInterval(() => {
      setLive((prev) =>
        prev.map((v, i) => {
          const next = v + (Math.random() - 0.4) * stats[i].jitter
          return Math.max(0, next)
        }),
      )
    }, 2000)
    return () => clearInterval(id)
  }, [stats])

  return (
    <section
      id="stats"
      aria-label="Live network statistics"
      className="border-y border-border"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:divide-y-0 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <StatItem key={stat.label} stat={stat} live={live[i]} />
          ))}
        </div>
      </div>
    </section>
  )
}
