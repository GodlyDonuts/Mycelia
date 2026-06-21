"use client"

import { useEffect, useRef, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts"
import { useNetwork } from "@/lib/api"

type UtilPoint = { t: number; util: number }

function seed(): UtilPoint[] {
  return Array.from({ length: 48 }, (_, i) => ({ t: i, util: 62 + Math.round(Math.sin(i / 5) * 12 + Math.cos(i / 11) * 7) }))
}

export function UtilizationChart() {
  const net = useNetwork()
  const [data, setData] = useState<UtilPoint[]>(seed)
  const tRef = useRef(48)

  // Append the live cluster-utilization sample as each network frame arrives.
  useEffect(() => {
    if (net?.utilization == null) return
    setData((prev) => [...prev.slice(1), { t: tRef.current++, util: Math.round(net.utilization) }])
  }, [net?.utilization])

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
            <Area type="monotone" dataKey="util" stroke="var(--color-primary)" strokeWidth={2} fill="url(#util-fill)" isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
