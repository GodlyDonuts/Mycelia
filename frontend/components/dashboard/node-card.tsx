"use client"

import {
  Laptop,
  Monitor,
  Server,
  Smartphone,
  Plus,
  Cpu,
  Coins,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { DeviceType, NodeData, NodeStatus } from "@/lib/dashboard-data"

const DEVICE_ICON: Record<DeviceType, typeof Laptop> = {
  laptop: Laptop,
  desktop: Monitor,
  gpu: Server,
  phone: Smartphone,
}

const STATUS_META: Record<NodeStatus, { label: string; dot: string; text: string; bg: string }> = {
  online: { label: "Online", dot: "bg-status-online", text: "text-status-online", bg: "bg-status-online/10" },
  idle: { label: "Idle", dot: "bg-status-idle", text: "text-status-idle", bg: "bg-status-idle/10" },
  offline: { label: "Offline", dot: "bg-status-offline", text: "text-status-offline", bg: "bg-status-offline/10" },
}

function StatusPill({ status }: { status: NodeStatus }) {
  const m = STATUS_META[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", m.bg, m.text)}>
      <span
        className={cn(
          "size-1.5 rounded-full",
          m.dot,
          status === "online" && "[animation:spore-pulse_2.4s_ease-in-out_infinite]",
        )}
      />
      {m.label}
    </span>
  )
}

/** Animated horizontal gauge. `value` updates from the telemetry stream. */
function Gauge({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  const v = Math.round(value)
  const hot = v >= 85
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-tertiary">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{v}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            hot ? "bg-accent" : accent ? "bg-primary" : "bg-primary/70",
          )}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  )
}

export function NodeCard({ node }: { node: NodeData }) {
  const Icon = DEVICE_ICON[node.type]
  const computing = node.status === "online" && !!node.job

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-5 transition-shadow",
        // soft teal pulse while actively computing
        computing ? "border-primary/30 [animation:node-glow_3.2s_ease-in-out_infinite]" : "border-border",
      )}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              computing ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
            )}
          >
            <Icon className="size-4.5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-mono text-sm font-medium text-foreground">{node.name}</p>
            <p className="font-mono text-[11px] capitalize text-tertiary">
              {node.type} · {node.location}
            </p>
          </div>
        </div>
        <StatusPill status={node.status} />
      </div>

      {/* gauges */}
      <div className="mt-5 grid grid-cols-1 gap-3">
        <Gauge label="CPU" value={node.cpu} />
        <Gauge label="GPU" value={node.gpu} accent />
        <Gauge label="RAM" value={node.ram} />
      </div>

      {/* current job */}
      <div className="mt-5 rounded-xl border border-border bg-secondary/50 p-3">
        {node.job ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 truncate font-mono text-xs text-foreground">
                <Cpu className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">{node.job.name}</span>
              </span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {Math.round(node.job.progress)}%
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                style={{ width: `${node.job.progress}%` }}
              />
            </div>
          </>
        ) : (
          <p className="font-mono text-xs text-tertiary">
            {node.status === "offline" ? "node unreachable" : "awaiting job assignment"}
          </p>
        )}
      </div>

      {/* earnings */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-[11px] uppercase tracking-wider text-tertiary">This epoch</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-foreground">
          <Coins className="size-3.5 text-primary" />
          {node.epochEarnings.toFixed(1)}
          <span className="text-xs font-normal text-muted-foreground">MYC</span>
        </span>
      </div>
    </div>
  )
}

export function NodeCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="size-9 animate-pulse rounded-lg bg-secondary" />
          <div className="space-y-2">
            <span className="block h-3 w-24 animate-pulse rounded bg-secondary" />
            <span className="block h-2.5 w-16 animate-pulse rounded bg-secondary" />
          </div>
        </div>
        <span className="h-5 w-16 animate-pulse rounded-full bg-secondary" />
      </div>
      <div className="mt-5 space-y-4">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-1.5 w-full animate-pulse rounded-full bg-secondary" />
        ))}
      </div>
      <span className="mt-5 block h-12 w-full animate-pulse rounded-xl bg-secondary" />
      <span className="mt-4 block h-4 w-full animate-pulse rounded bg-secondary" />
    </div>
  )
}

export function AddDeviceCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-transparent p-5 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-tertiary text-tertiary transition-colors group-hover:border-primary group-hover:text-primary">
        <Plus className="size-5" />
      </span>
      <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        Add a device
      </span>
      <span className="max-w-[14rem] text-pretty text-xs text-tertiary">
        Enroll another CPU or GPU to grow your share of the living network.
      </span>
    </button>
  )
}
