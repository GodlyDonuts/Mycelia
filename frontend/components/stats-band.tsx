"use client"

import { useEffect, useState } from "react"
import { useCountUp } from "@/hooks/use-count-up"

export type LiveStat = {
  label: string
  /** base value used for the count-up animation */
  value: number
  /** how many decimals to display */
  decimals?: number
  suffix?: string
  /** ± jitter applied on the live update interval */
  jitter: number
}

// NOTE: placeholder values. Wire to the live telemetry stream
// (e.g. WebSocket / SSE from the scheduler) where marked below.
const DEFAULT_STATS: LiveStat[] = [
  { label: "Active Nodes", value: 1284530, jitter: 240 },
  { label: "GPUs Online", value: 342118, jitter: 90 },
  { label: "Network TFLOP/s", value: 8472.6, decimals: 1, jitter: 12 },
  { label: "Jobs Running", value: 9417, jitter: 18 },
]

function format(n: number, decimals = 0) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function StatItem({ stat, live }: { stat: LiveStat; live: number }) {
  const { ref, value } = useCountUp(stat.value)
  // once the count-up has effectively finished, show the jittering live value
  const display = value >= stat.value * 0.999 ? live : value

  return (
    <div className="flex flex-col gap-1 px-2 py-6 text-center">
      <span
        ref={ref}
        className="font-mono text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl"
      >
        {format(display, stat.decimals)}
        {stat.suffix ?? ""}
      </span>
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
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
      className="border-y border-border bg-card/40"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:divide-y-0 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <StatItem key={stat.label} stat={stat} live={live[i]} />
          ))}
        </div>
      </div>
    </section>
  )
}
