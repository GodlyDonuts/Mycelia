"use client"

import { useEffect, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts"
import { UTIL_SEED, type UtilPoint } from "@/lib/network-data"

export function UtilizationChart() {
  const [data, setData] = useState<UtilPoint[]>(UTIL_SEED)

  // SSE: cluster utilization samples arrive a few times per second. We shift a
  // fixed-width window and push a smoothly-varying new sample each tick.
  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        const lastT = prev[prev.length - 1].t
        const last = prev[prev.length - 1].util
        // random walk bounded to a believable 45–95% band
        const next = Math.max(45, Math.min(95, last + (Math.random() - 0.5) * 8))
        return [...prev.slice(1), { t: lastT + 1, util: Math.round(next) }]
      })
    }, 1100)
    return () => clearInterval(id)
  }, [])

  const current = data[data.length - 1].util

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Cluster Utilization</h2>
          <p className="font-mono text-[11px] text-tertiary">all nodes · streaming</p>
        </div>
        <span className="font-mono text-lg font-semibold tabular-nums text-primary">{current}%</span>
      </div>

      <div className="h-40 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="util-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={[0, 100]} hide />
            <Area
              type="monotone"
              dataKey="util"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#util-fill)"
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
