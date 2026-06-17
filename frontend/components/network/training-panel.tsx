"use client"

import { useEffect, useState } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { LOSS_HISTORY, NODE_CONTRIB, type LossPoint } from "@/lib/network-data"

function LossTooltip({ active, payload }: { active?: boolean; payload?: { payload: LossPoint }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      <p className="font-mono text-[11px] text-tertiary">round {p.round}</p>
      <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {p.loss.toFixed(3)} <span className="text-xs font-normal text-muted-foreground">loss</span>
      </p>
    </div>
  )
}

export function TrainingPanel() {
  const [history, setHistory] = useState<LossPoint[]>(LOSS_HISTORY)
  const [contrib, setContrib] = useState(NODE_CONTRIB)

  // SSE: each completed aggregation round emits a new global loss + the
  // per-node gradient contribution split. Here we append a decaying point and
  // jitter the contribution shares on an interval.
  useEffect(() => {
    const id = setInterval(() => {
      setHistory((prev) => {
        const last = prev[prev.length - 1]
        const nextRound = last.round + 1
        // continue the exponential-ish decay toward an asymptote with small noise
        const target = 0.16
        const loss = Math.max(target, last.loss - (last.loss - target) * 0.12 + (Math.random() - 0.5) * 0.02)
        const next = [...prev, { round: nextRound, loss: Math.round(loss * 1000) / 1000 }]
        return next.slice(-24)
      })
      setContrib((prev) => {
        const jittered = prev.map((c) => ({ ...c, share: Math.max(0.04, c.share + (Math.random() - 0.5) * 0.04) }))
        const sum = jittered.reduce((s, c) => s + c.share, 0)
        return jittered.map((c) => ({ ...c, share: c.share / sum }))
      })
    }, 2600)
    return () => clearInterval(id)
  }, [])

  const current = history[history.length - 1]
  const round = current.round

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Training</h2>
          <p className="font-mono text-[11px] text-tertiary">llama-ft-7b · LoRA · round {round}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] text-tertiary">val loss</p>
          <p className="font-mono text-lg font-semibold tabular-nums text-primary">{current.loss.toFixed(3)}</p>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* loss curve */}
        <div className="h-48 w-full lg:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="round"
                tick={{ fill: "var(--color-tertiary)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                domain={[0, "auto"]}
                tick={{ fill: "var(--color-tertiary)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip content={<LossTooltip />} cursor={{ stroke: "var(--color-border)" }} />
              <Line
                type="monotone"
                dataKey="loss"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* per-node contribution bars */}
        <div className="flex flex-col justify-center gap-2.5">
          <p className="font-mono text-[11px] text-tertiary">gradient contribution</p>
          {contrib.map((c) => (
            <div key={c.node} className="flex flex-col gap-1">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="truncate text-muted-foreground">{c.node}</span>
                <span className="tabular-nums text-foreground">{Math.round(c.share * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                  style={{ width: `${c.share * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
