"use client"

import { useEffect, useState } from "react"
import { LogIn, LogOut, Share2, CheckCircle2, Layers, Coins, XCircle, Activity } from "lucide-react"
import { useNetwork } from "@/lib/api"
import { cn } from "@/lib/utils"

const KIND_META: Record<string, { icon: typeof LogIn; tint: string; verb: string }> = {
  join: { icon: LogIn, tint: "text-status-online", verb: "joined" },
  leave: { icon: LogOut, tint: "text-status-offline", verb: "left" },
  fanout: { icon: Share2, tint: "text-primary", verb: "fanned out" },
  "tile-verified": { icon: CheckCircle2, tint: "text-primary", verb: "verified" },
  "tile-rejected": { icon: XCircle, tint: "text-status-offline", verb: "rejected" },
  "round-aggregated": { icon: Layers, tint: "text-accent", verb: "settled" },
  credited: { icon: Coins, tint: "text-accent", verb: "earned" },
}
const FALLBACK = { icon: Activity, tint: "text-muted-foreground", verb: "" }

function relTime(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.round(m / 60)}h ago`
}

export function NetworkEventLog() {
  const net = useNetwork()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const events = net?.events ?? []

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
        {events.map((e) => {
          const m = KIND_META[e.kind] ?? FALLBACK
          const Icon = m.icon
          return (
            <li key={e.id} className="flex items-start gap-3 px-1 py-2.5 [animation:fade-in-up_0.4s_ease-out]">
              <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary", m.tint)}>
                <Icon className="size-3.5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground">
                  <span className="font-mono font-medium">{e.node}</span>{" "}
                  <span className="text-muted-foreground">{m.verb}</span>{" "}
                  <span className={cn("font-mono", (e.kind === "credited" || e.kind === "round-aggregated") && "text-accent")}>{e.detail}</span>
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-tertiary">{mounted ? relTime(e.ts) : " "}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
