"use client"

import { useEffect, useRef, useState } from "react"
import { useNetwork } from "@/lib/api"

type Fmt = "int" | "dec1" | "group"

function fmt(v: number, kind: Fmt) {
  if (kind === "dec1") return v.toFixed(1)
  return Math.round(v).toLocaleString("en-US")
}

/** A stat whose display eases toward a live target set from the network feed. */
function StatCell({ label, value, unit, fmtKind }: { label: string; value: number; unit?: string; fmtKind: Fmt }) {
  const [display, setDisplay] = useState(value)
  const target = useRef(value)
  const current = useRef(value)
  target.current = value

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
      <span className="truncate text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-mono text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{fmt(display, fmtKind)}</span>
        {unit && <span className="font-mono text-[11px] text-tertiary">{unit}</span>}
      </span>
    </div>
  )
}

export function ClusterStatBand() {
  const net = useNetwork()
  const c = net?.cluster
  const cells: Array<{ label: string; value: number; unit?: string; fmtKind: Fmt }> = [
    { label: "Nodes Online", value: c?.nodesOnline ?? 0, fmtKind: "group" },
    { label: "GPUs Online", value: c?.gpusOnline ?? 0, fmtKind: "group" },
    { label: "Network TFLOP/s", value: c?.tflops ?? 0, unit: "TF", fmtKind: "group" },
    { label: "Throughput", value: c?.throughput ?? 0, unit: "GB/s", fmtKind: "dec1" },
    { label: "Jobs Running", value: c?.jobsRunning ?? 0, fmtKind: "int" },
    { label: "Credits Paid", value: net?.creditedMyc ?? 0, unit: "MYC", fmtKind: "group" },
  ]
  return (
    <section aria-label="Aggregate cluster statistics" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        {cells.map((s) => (
          <StatCell key={s.label} label={s.label} value={s.value} unit={s.unit} fmtKind={s.fmtKind} />
        ))}
      </div>
    </section>
  )
}
