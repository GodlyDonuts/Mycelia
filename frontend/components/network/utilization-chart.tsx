"use client"

import { useEffect, useRef, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts"
import { useNetwork } from "@/lib/api"

type UtilPoint = { t: number; util: number }

export function UtilizationChart() {
  const net = useNetwork()
  const [data, setData] = useState<UtilPoint[]>([])
  const tRef = useRef(0)

  // Append the live cluster-utilization sample as each network frame arrives.
  useEffect(() => {
    if (net?.utilization == null) return
    setData((prev) => [...prev.slice(1), { t: tRef.current++, util: Math.round(net.utilization) }])
  }, [net?.utilization])

  const current = data.at(-1)?.util

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Cluster Utilization</h2>
          <p className="font-mono text-[11px] text-tertiary">all nodes · streaming</p>
        </div>
        <span className="font-mono text-lg font-semibold tabular-nums text-primary">{current == null ? "—" : `${current}%`}</span>
      </div>
      <div className="h-40 w-full flex-1">
        {data.length === 0 ? <div className="flex h-full items-center justify-center font-mono text-[11px] text-tertiary">waiting for telemetry…</div> : <ResponsiveContainer width="100%" height="100%">
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
        </ResponsiveContainer>}
      </div>
    </div>
  )
}
