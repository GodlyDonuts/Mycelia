"use client"

import { useState } from "react"
import { Power, Thermometer, MoonStar } from "lucide-react"
import { cn } from "@/lib/utils"

export function PowerControl() {
  // These settings would POST to the node agent config endpoint and take
  // effect on the next heartbeat. Local state today; wire to the device API.
  const [cap, setCap] = useState(80)
  const [onlyIdle, setOnlyIdle] = useState(true)

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Power className="size-4 text-primary" strokeWidth={1.75} />
        <h2 className="text-sm font-medium text-foreground">Power &amp; thermal</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Tune how hard your nodes work. Lower caps run cooler and quieter.
      </p>

      {/* contribution cap */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Thermometer className="size-4 text-primary" />
            Contribution cap
          </span>
          <span className="font-mono tabular-nums text-primary">{cap}%</span>
        </div>
        <input
          type="range"
          min={50}
          max={100}
          step={5}
          value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
          aria-label="Contribution cap percentage"
          className="myc-slider w-full"
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-tertiary">
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* only when idle */}
      <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-secondary/50 p-3">
        <span className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <MoonStar className="size-4" strokeWidth={1.75} />
          </span>
          <span>
            <span className="block text-sm font-medium text-foreground">Only when idle</span>
            <span className="block text-xs text-muted-foreground">Pause if you&apos;re actively using the device</span>
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={onlyIdle}
          aria-label="Only contribute when idle"
          onClick={() => setOnlyIdle((v) => !v)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
            onlyIdle ? "bg-primary" : "bg-secondary",
          )}
        >
          <span
            className={cn(
              "inline-block size-4 transform rounded-full bg-background transition-transform",
              onlyIdle ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>
    </div>
  )
}
