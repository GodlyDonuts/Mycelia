"use client"

import { useEffect, useRef, useState } from "react"
import { LogIn, LogOut, Share2, CheckCircle2, Layers, Coins } from "lucide-react"
import { NET_EVENTS, NET_EVENT_SAMPLES, type NetEventKind, type NetEvent } from "@/lib/network-data"
import { cn } from "@/lib/utils"

const KIND_META: Record<NetEventKind, { icon: typeof LogIn; tint: string; verb: string }> = {
  join: { icon: LogIn, tint: "text-status-online", verb: "joined" },
  leave: { icon: LogOut, tint: "text-status-offline", verb: "left" },
  fanout: { icon: Share2, tint: "text-primary", verb: "fanned out" },
  "tile-verified": { icon: CheckCircle2, tint: "text-primary", verb: "verified" },
  "round-aggregated": { icon: Layers, tint: "text-accent", verb: "aggregated" },
  credited: { icon: Coins, tint: "text-accent", verb: "earned" },
}

function relTime(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.round(m / 60)}h ago`
}

function EventRow({ e, mounted }: { e: NetEvent; mounted: boolean }) {
  const m = KIND_META[e.kind]
  const Icon = m.icon
  return (
    <li className="flex items-start gap-3 px-1 py-2.5 [animation:fade-in-up_0.4s_ease-out]">
      <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary", m.tint)}>
        <Icon className="size-3.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground">
          <span className="font-mono font-medium">{e.node}</span>{" "}
          <span className="text-muted-foreground">{m.verb}</span>{" "}
          <span className={cn("font-mono", (e.kind === "credited" || e.kind === "round-aggregated") && "text-accent")}>
            {e.detail}
          </span>
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-tertiary">{mounted ? relTime(e.ts) : "\u00a0"}</p>
      </div>
    </li>
  )
}

export function NetworkEventLog({ initial = NET_EVENTS }: { initial?: NetEvent[] }) {
  const [events, setEvents] = useState<NetEvent[]>(initial)
  const [mounted, setMounted] = useState(false)
  const counter = useRef(0)

  useEffect(() => {
    setMounted(true)
    // SSE: replace this interval with the mesh event socket —
    // `setEvents((prev) => [incoming, ...prev].slice(0, 60))`.
    const id = setInterval(() => {
      const s = NET_EVENT_SAMPLES[counter.current % NET_EVENT_SAMPLES.length]
      counter.current += 1
      setEvents((prev) => [{ ...s, id: `live-${counter.current}`, ts: Date.now() }, ...prev].slice(0, 50))
    }, 2400)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Network Events</h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-tertiary">
          <span className="size-1.5 rounded-full bg-primary [animation:spore-pulse_2.4s_ease-in-out_infinite]" />
          live
        </span>
      </div>
      <ul className="-mr-1 flex-1 divide-y divide-border overflow-y-auto pr-1" style={{ maxHeight: "26rem" }}>
        {events.map((e) => (
          <EventRow key={e.id} e={e} mounted={mounted} />
        ))}
      </ul>
    </div>
  )
}
