"use client"

import { useMemo, useState, useEffect } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { JobCard } from "./job-card"
import {
  JOB_LISTINGS,
  JOB_TYPE_META,
  GPU_TIERS,
  type JobListing,
  type JobType,
  type GpuTier,
} from "@/lib/marketplace-data"

const TYPE_FILTERS: { value: JobType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "render", label: JOB_TYPE_META.render.label },
  { value: "inference", label: JOB_TYPE_META.inference.label },
  { value: "sim", label: JOB_TYPE_META.sim.label },
  { value: "lora", label: JOB_TYPE_META.lora.label },
]

const REWARD_FILTERS: { value: string; label: string; min: number; max: number }[] = [
  { value: "any", label: "Any reward", min: 0, max: Number.POSITIVE_INFINITY },
  { value: "lt500", label: "< 500 MYC", min: 0, max: 500 },
  { value: "500-1500", label: "500–1500", min: 500, max: 1500 },
  { value: "gt1500", label: "> 1500 MYC", min: 1500, max: Number.POSITIVE_INFINITY },
]

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 rounded-lg border border-input bg-secondary/50 px-2.5 text-xs text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-card text-foreground">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Left pane: the live job board. `jobs` is static mock data today — wire it to
 * the scheduler's job-board feed (WebSocket/SSE) so listings, progress bars,
 * and statuses update in place.
 */
export function JobBoard({ jobs = JOB_LISTINGS }: { jobs?: JobListing[] }) {
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState("")
  const [type, setType] = useState<JobType | "all">("all")
  const [tier, setTier] = useState<GpuTier | "all">("all")
  const [reward, setReward] = useState("any")

  useEffect(() => setMounted(true), [])

  const filtered = useMemo(() => {
    const rf = REWARD_FILTERS.find((r) => r.value === reward)!
    return jobs.filter((j) => {
      if (type !== "all" && j.type !== type) return false
      if (tier !== "all" && j.gpuTier !== tier) return false
      if (j.reward < rf.min || j.reward >= rf.max) return false
      if (query && !`${j.name} ${j.requester} ${j.id}`.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [jobs, type, tier, reward, query])

  return (
    <section aria-label="Available jobs" className="flex flex-col gap-4">
      {/* search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tertiary" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search jobs, requesters, IDs…"
          aria-label="Search jobs"
          className="h-10 w-full rounded-lg border border-input bg-secondary/50 pl-9 pr-3 text-sm text-foreground placeholder:text-tertiary outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* type chips */}
      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              type === t.value
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* dropdown filters */}
      <div className="grid grid-cols-2 gap-3">
        <Select<GpuTier | "all">
          label="GPU tier"
          value={tier}
          onChange={setTier}
          options={[{ value: "all", label: "Any tier" }, ...GPU_TIERS.map((g) => ({ value: g.value, label: g.label }))]}
        />
        <Select
          label="Reward"
          value={reward}
          onChange={setReward}
          options={REWARD_FILTERS.map((r) => ({ value: r.value, label: r.label }))}
        />
      </div>

      {/* result count */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-tertiary">
          <SlidersHorizontal className="size-3" />
          {filtered.length} of {jobs.length} jobs
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-tertiary">
          <span className="size-1.5 rounded-full bg-primary [animation:spore-pulse_2.4s_ease-in-out_infinite]" />
          live board
        </span>
      </div>

      {/* list */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} mounted={mounted} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">No jobs match these filters.</p>
          <p className="mt-1 font-mono text-xs text-tertiary">Loosen the filters to see more of the board.</p>
        </div>
      )}
    </section>
  )
}
