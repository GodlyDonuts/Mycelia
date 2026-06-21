"use client"

import { useEffect, useState } from "react"
import { LogIn, LogOut, Cpu, CircleCheck, Coins, Activity } from "lucide-react"
import { EVENT_LOG, type EventLogEntry } from "@/lib/dashboard-data"
import { usePoll } from "@/lib/api"
import { cn } from "@/lib/utils"

type EventMeta = { icon: typeof LogIn; tint: string; verb: string }

const KIND_META: Record<string, EventMeta> = {
  join: { icon: LogIn, tint: "text-status-online", verb: "joined" },
  leave: { icon: LogOut, tint: "text-status-offline", verb: "left" },
  assigned: { icon: Cpu, tint: "text-primary", verb: "assigned" },
  completed: { icon: CircleCheck, tint: "text-primary", verb: "completed" },
  credited: { icon: Coins, tint: "text-accent", verb: "earned" },
  fanout: { icon: Cpu, tint: "text-primary", verb: "fanned out" },
  "tile-verified": { icon: CircleCheck, tint: "text-primary", verb: "verified" },
  "round-aggregated": { icon: Activity, tint: "text-primary", verb: "aggregated" },
}

// Unknown / unmapped event kinds render with a neutral fallback rather than crashing.
const FALLBACK_META: EventMeta = { icon: Activity, tint: "text-muted-foreground", verb: "" }

function relTime(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.round(m / 60)}h ago`
}

function EventRow({ e, mounted }: { e: EventLogEntry; mounted: boolean }) {
  const m = KIND_META[e.kind] ?? FALLBACK_META
  const Icon = m.icon
  return (
    <li className="flex items-start gap-3 px-1 py-2.5 [animation:fade-in-up_0.4s_ease-out]">
      <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary", m.tint)}>
        <Icon className="size-3.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground">
          <span className="font-mono font-medium">{e.node}</span>{" "}
          {m.verb && <><span className="text-muted-foreground">{m.verb}</span>{" "}</>}
          <span className={cn("font-mono", e.kind === "credited" && "text-accent")}>{e.detail}</span>
        </p>
        {/* time is relative to "now", so only render after mount to avoid SSR/client mismatch */}
        <p className="mt-0.5 font-mono text-[10px] text-tertiary">{mounted ? relTime(e.ts) : "\u00a0"}</p>
      </div>
    </li>
  )
}

type DashboardPayload = { events: EventLogEntry[] }

export function EventLog({ initial = EVENT_LOG }: { initial?: EventLogEntry[] }) {
  const [mounted, setMounted] = useState(false)
  // LIVE FEED: events stream from the read API, newest-first. Fall back to the
  // mock log until the first frame arrives so SSR + first paint render.
  const { data } = usePoll<DashboardPayload>("/api/dashboard", 2000)
  const events = (data?.events ?? initial).slice(0, 40)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Activity</h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-tertiary">
          <span className="size-1.5 rounded-full bg-primary [animation:spore-pulse_2.4s_ease-in-out_infinite]" />
          live
        </span>
      </div>
      <ul className="-mr-1 flex-1 divide-y divide-border overflow-y-auto pr-1" style={{ maxHeight: "22rem" }}>
        {events.map((e) => (
          <EventRow key={e.id} e={e} mounted={mounted} />
        ))}
      </ul>
    </div>
  )
}
