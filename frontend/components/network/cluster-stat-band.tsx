"use client"

import { useEffect, useRef, useState } from "react"
import { CLUSTER_STATS, type ClusterStat } from "@/lib/network-data"

function fmt(v: number, kind: ClusterStat["fmt"]) {
  if (kind === "int") return Math.round(v).toLocaleString("en-US")
  if (kind === "dec1") return v.toFixed(1)
  return Math.round(v).toLocaleString("en-US")
}

/**
 * A single stat whose value eases toward a live target. The target is nudged
 * on an interval here to simulate the feed; in production the target is set
 * from the SSE aggregate-metrics frame and the easing stays identical.
 */
function StatCell({ stat }: { stat: ClusterStat }) {
  const [display, setDisplay] = useState(stat.value)
  const target = useRef(stat.value)
  const current = useRef(stat.value)

  // SSE: replace this jitter interval with `target.current = frame[stat.id]`.
  useEffect(() => {
    const drift = setInterval(() => {
      const base = stat.value
      const swing = base * 0.012 + (stat.fmt === "dec1" ? 0.3 : 4)
      target.current = base + (Math.random() - 0.5) * 2 * swing
    }, 2200)
    return () => clearInterval(drift)
  }, [stat.value, stat.fmt])

  // smooth eased animation toward the target (~60fps, framerate-independent)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      const diff = target.current - current.current
      current.current += diff * (1 - Math.exp(-dt / 380))
      setDisplay(current.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 py-3 sm:px-5">
      <span className="truncate text-[11px] uppercase tracking-widest text-muted-foreground">{stat.label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-mono text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
          {fmt(display, stat.fmt)}
        </span>
        {stat.unit && <span className="font-mono text-[11px] text-tertiary">{stat.unit}</span>}
      </span>
    </div>
  )
}

export function ClusterStatBand() {
  return (
    <section
      aria-label="Aggregate cluster statistics"
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        {CLUSTER_STATS.map((s) => (
          <StatCell key={s.id} stat={s} />
        ))}
      </div>
    </section>
  )
}
