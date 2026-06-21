"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useNetwork } from "@/lib/api"

type GraphNode = {
  id: string; label: string; kind: "gpu" | "desktop" | "laptop" | "phone"
  capacity: number; load: number; gpu: string; job: string | null; x: number; y: number
}

// teal #2ee6c5 -> amber #f5b544 by load
function loadColor(load: number) {
  const a = { r: 0x2e, g: 0xe6, b: 0xc5 }
  const b = { r: 0xf5, g: 0xb5, b: 0x44 }
  const t = Math.max(0, Math.min(1, load))
  return `rgb(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(a.g + (b.g - a.g) * t)}, ${Math.round(a.b + (b.b - a.b) * t)})`
}

const VB = 1000
const px = (n: number) => n * VB
type Tooltip = { node: GraphNode; sx: number; sy: number } | null

export function MyceliumGraph() {
  const net = useNetwork()
  const [tick, setTick] = useState(0)
  const [hover, setHover] = useState<Tooltip>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const nodes: GraphNode[] = net?.graphNodes ?? []
  const links = net?.links ?? []

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const loop = (now: number) => {
      setTick((now - start) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>()
    nodes.forEach((n) => m.set(n.id, n))
    return m
  }, [nodes])

  function showTip(node: GraphNode, e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    setHover({ node, sx: e.clientX - rect.left, sy: e.clientY - rect.top })
  }

  return (
    <div className="relative flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Mycelium Mesh</h2>
          <p className="font-mono text-[11px] text-tertiary">{net?.cluster.nodesOnline ?? nodes.length} nodes · {links.length} threads</p>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-tertiary">
          <span className="size-1.5 rounded-full bg-primary [animation:spore-pulse_2.4s_ease-in-out_infinite]" />
          live topology
        </span>
      </div>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Animated node-link diagram of the compute mesh">
          <defs>
            <radialGradient id="mesh-haze" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.06} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle cx={VB / 2} cy={VB / 2} r={VB / 2} fill="url(#mesh-haze)" />

          <g>
            {links.map((l, i) => {
              const s = nodeById.get(l.source)
              const tg = nodeById.get(l.target)
              if (!s || !tg) return null
              const x1 = px(s.x), y1 = px(s.y), x2 = px(tg.x), y2 = px(tg.y)
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1
              const curve = Math.sin(tick * 0.4 + i) * 18
              const cx = mx - (dy / VB) * 120 + curve
              const cy = my + (dx / VB) * 120 + curve
              const dash = 14 + l.flow * 10
              const offset = -(tick * (20 + l.flow * 60)) % (dash * 2)
              return (
                <g key={`${l.source}-${l.target}-${i}`}>
                  <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} fill="none" stroke="var(--color-primary)" strokeOpacity={0.1 + l.flow * 0.12} strokeWidth={1.2} />
                  <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} fill="none" stroke="var(--color-primary)" strokeOpacity={0.35 + l.flow * 0.35} strokeWidth={1.6} strokeLinecap="round" strokeDasharray={`${dash} ${dash}`} strokeDashoffset={offset} />
                </g>
              )
            })}
          </g>

          <g>
            {nodes.map((n, i) => {
              const cx = px(n.x), cy = px(n.y)
              const baseR = 9 + n.capacity * 24
              const pulse = 1 + Math.sin(tick * 1.6 + i) * 0.06 * (0.4 + n.load)
              const r = baseR * pulse
              const color = loadColor(n.load)
              const isHub = n.capacity >= 0.99
              return (
                <g key={n.id} onMouseEnter={(e) => showTip(n, e)} onMouseMove={(e) => showTip(n, e)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
                  <circle cx={cx} cy={cy} r={r * 2.1} fill={color} opacity={0.07} />
                  <circle cx={cx} cy={cy} r={r * 1.5} fill={color} opacity={0.1} />
                  <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={isHub ? 0.95 : 0.85} stroke="var(--color-background)" strokeWidth={2} />
                  <circle cx={cx} cy={cy} r={r * 0.4} fill="var(--color-background)" fillOpacity={0.35} />
                </g>
              )
            })}
          </g>
        </svg>

        {hover && (
          <div className="pointer-events-none absolute z-10 w-52 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border border-border bg-popover p-3 shadow-xl" style={{ left: hover.sx, top: hover.sy }} role="status">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-foreground">{hover.node.label}</span>
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide" style={{ color: loadColor(hover.node.load), backgroundColor: "var(--color-secondary)" }}>
                {hover.node.kind}
              </span>
            </div>
            <dl className="mt-2 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between"><dt className="text-tertiary">gpu</dt><dd className="text-foreground">{hover.node.gpu}</dd></div>
              <div className="flex justify-between"><dt className="text-tertiary">load</dt><dd style={{ color: loadColor(hover.node.load) }}>{Math.round(hover.node.load * 100)}%</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-tertiary">job</dt><dd className="truncate text-right text-foreground">{hover.node.job ?? "idle"}</dd></div>
            </dl>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[11px] text-tertiary">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: loadColor(0.05) }} /> low load</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: loadColor(0.95) }} /> high load</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-tertiary" /> size = capacity</span>
      </div>
    </div>
  )
}
