"use client"

import { Coins, Clock, Layers, Server, Cpu, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  JOB_TYPE_META,
  JOB_STATUS_META,
  type JobListing,
} from "@/lib/marketplace-data"

function TypeBadge({ type }: { type: JobListing["type"] }) {
  const m = JOB_TYPE_META[type]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider",
        m.tint,
        m.bg,
        m.border,
      )}
    >
      {m.short}
    </span>
  )
}

function StatusPill({ status }: { status: JobListing["status"] }) {
  const m = JOB_STATUS_META[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        m.bg,
        m.tint,
      )}
    >
      <span className={cn("size-1.5 rounded-full", m.dot, m.live && "[animation:spore-pulse_2.4s_ease-in-out_infinite]")} />
      {m.label}
    </span>
  )
}

/** Relative deadline label. Render only after mount to avoid SSR mismatch. */
function deadlineLabel(iso: string, mounted: boolean) {
  if (!mounted) return "\u00a0"
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return "due"
  const h = Math.floor(diff / 3600_000)
  if (h < 1) return `${Math.round(diff / 60_000)}m left`
  if (h < 24) return `${h}h left`
  return `${Math.round(h / 24)}d left`
}

function MetaItem({ icon: Icon, children }: { icon: typeof Coins; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
      <Icon className="size-3.5 shrink-0 text-tertiary" strokeWidth={1.75} />
      {children}
    </span>
  )
}

export function JobCard({ job, mounted }: { job: JobListing; mounted: boolean }) {
  const pct = job.tilesTotal > 0 ? Math.round((job.tilesDone / job.tilesTotal) * 100) : 0
  const running = job.status === "running"
  const gpuLabel = job.gpuTier === "none" ? "CPU only" : job.gpuTier
  const urgent = mounted && new Date(job.deadline).getTime() - Date.now() < 3 * 3600_000

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border bg-card p-4 transition-colors hover:border-primary/30",
        running ? "border-primary/20" : "border-border",
      )}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TypeBadge type={job.type} />
            <span className="truncate font-mono text-[11px] text-tertiary">{job.id}</span>
          </div>
          <h3 className="mt-1.5 truncate text-sm font-medium text-foreground">{job.name}</h3>
          <p className="font-mono text-[11px] text-tertiary">by {job.requester}</p>
        </div>
        <StatusPill status={job.status} />
      </div>

      {/* requirements */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <MetaItem icon={Server}>{gpuLabel}</MetaItem>
        <MetaItem icon={Cpu}>
          {job.vram}GB VRAM · {job.ram}GB RAM
        </MetaItem>
        {job.replication > 0 && (
          <MetaItem icon={Users}>
            {job.replication}× node{job.replication > 1 ? "s" : ""}
          </MetaItem>
        )}
      </div>

      {/* progress */}
      <div className="mt-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-tertiary">
            <Layers className="size-3" />
            {job.status === "completed" ? "complete" : "tiles / rounds"}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {job.tilesDone}/{job.tilesTotal} · {pct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              job.status === "completed" ? "bg-tertiary" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* footer: reward + deadline */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-foreground">
          <Coins className="size-3.5 text-primary" />
          {job.reward.toLocaleString()}
          <span className="text-xs font-normal text-muted-foreground">MYC</span>
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums",
            urgent ? "text-accent" : "text-tertiary",
          )}
        >
          <Clock className="size-3" />
          {deadlineLabel(job.deadline, mounted)}
        </span>
      </div>
    </article>
  )
}
