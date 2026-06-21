"use client"

import { useCountUp } from "@/hooks/use-count-up"
import { usePoll } from "@/lib/api"

export type LiveStat = {
  label: string
  value: number
  decimals?: number
  suffix?: string
  jitter: number
}

type StatsResponse = {
  nodesOnline: number
  gpusOnline: number
  tflops: number
  jobsRunning: number
  creditedMyc: number
}

// Fallback values shown until the first /api/stats frame arrives.
const DEFAULT_STATS: LiveStat[] = [
  { label: "Active nodes", value: 1284530, jitter: 240 },
  { label: "GPUs online", value: 342118, jitter: 90 },
  { label: "Network TFLOP/s", value: 8472.6, decimals: 1, jitter: 12 },
  { label: "Jobs running", value: 9417, jitter: 18 },
]

// Maps a live /api/stats frame onto the four telemetry tiles (same order as
// DEFAULT_STATS). MYC paid is surfaced as a suffixed string on jobs running's
// peer slot only if a credits tile exists — the four-column band has none, so
// creditedMyc is intentionally not displayed here.
function liveValues(d: StatsResponse): number[] {
  return [d.nodesOnline, d.gpusOnline, d.tflops, d.jobsRunning]
}

function format(n: number, decimals = 0) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function StatItem({ stat, target, live }: { stat: LiveStat; target: number; live: number }) {
  const { ref, value } = useCountUp(target)
  const display = value >= target * 0.999 ? live : value

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
  // Live read path: poll /api/stats every 3s. `data` is null until the first
  // frame lands, so we fall back to each tile's hardcoded value meanwhile.
  const { data } = usePoll<StatsResponse>("/api/stats", 3000)
  const live = data ? liveValues(data) : stats.map((s) => s.value)

  return (
    <section
      id="stats"
      aria-label="Live network statistics"
      className="border-y border-border"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:divide-y-0 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <StatItem
              key={stat.label}
              stat={stat}
              target={live[i] ?? stat.value}
              live={live[i] ?? stat.value}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
