"use client"

import { useState } from "react"
import { NlIntake } from "./nl-intake"
import { cn } from "@/lib/utils"
import { Coins, Clock, Cpu, CircleAlert, Send, Lightbulb } from "lucide-react"
import {
  EMPTY_JOB,
  GPU_TIERS,
  JOB_TYPE_META,
  estimateCost,
  type JobFormState,
  type JobType,
  type GpuTier,
} from "@/lib/marketplace-data"
import { SLA_TIERS, SLA_MULTIPLIER } from "@/lib/jobspec"

// ---- field primitives ----------------------------------------------------

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {hint && <span className="font-mono text-[10px] text-tertiary">{hint}</span>}
      </span>
      {children}
      {error && (
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-destructive">
          <CircleAlert className="size-3" />
          {error}
        </span>
      )}
    </label>
  )
}

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-secondary/50 px-2.5 text-sm text-foreground placeholder:text-tertiary outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/30"

// ---- validation -----------------------------------------------------------

function validate(f: JobFormState) {
  const e: Partial<Record<keyof JobFormState, string>> = {}
  if (!f.name.trim()) e.name = "Job name is required"
  if (!f.image.trim()) e.image = "Container image or model ref required"
  if (f.maxRuntimeMin < 1) e.maxRuntimeMin = "Must be at least 1 minute"
  if (f.replication < 1) e.replication = "At least 1 node"
  if (f.rewardBid <= 0) e.rewardBid = "Enter a reward bid"
  return e
}

export function SubmitJob() {
  const [form, setForm] = useState<JobFormState>({ ...EMPTY_JOB, name: "" })
  const [autofilled, setAutofilled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tier, setTier] = useState<"standard" | "priority" | "realtime">("standard")
  const [result, setResult] = useState<{ jobId?: string; error?: string } | null>(null)

  const set = <K extends keyof JobFormState>(key: K, value: JobFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const submit = async () => {
    setSubmitting(true)
    setResult(null)
    try {
      // POST to the real coordinator: inserts job + tiles + escrow debit (PLAN.md §3).
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, tier }),
      })
      const data = await res.json()
      if (data.ok) setResult({ jobId: data.jobId })
      else
        setResult({
          error:
            data.error === "INSUFFICIENT_FUNDS"
              ? "Insufficient MYC balance for this bid."
              : data.error === "PROVIDER_CANNOT_SUBMIT"
                ? "You're signed in as a Provider — switch to a Requester account to submit jobs."
                : data.error,
        })
    } catch {
      setResult({ error: "Network error — could not reach the coordinator." })
    } finally {
      setSubmitting(false)
    }
  }

  // when a GPU tier is picked, suggest its baseline VRAM/RAM
  const onTier = (tier: GpuTier) => {
    const meta = GPU_TIERS.find((g) => g.value === tier)!
    setForm((prev) => ({ ...prev, gpuTier: tier, vram: meta.vram, ram: meta.ram }))
  }

  const errors = validate(form)
  const valid = Object.keys(errors).length === 0
  const est = estimateCost({
    gpuTier: form.gpuTier,
    vram: form.vram,
    ram: form.ram,
    maxRuntimeMin: form.maxRuntimeMin,
    replication: form.replication,
  })

  return (
    <section aria-label="Submit a job" className="flex flex-col gap-4">
      {/* ---- magical NL centerpiece ---- */}
      <NlIntake
        onParsed={(spec) => {
          setForm(spec)
          setAutofilled(true)
          setResult(null)
        }}
      />

      {/* ---- structured form (kept in sync with the NL spec) ---- */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Job specification</h2>
          {autofilled && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary [animation:fade-in-up_0.4s_ease-out]">
              <Lightbulb className="size-3" />
              auto-filled from prompt
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Job name" error={errors.name}>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. llama-3-8b LoRA fine-tune"
              />
            </Field>
          </div>

          <Field label="Type">
            <select
              className={inputCls}
              value={form.type}
              onChange={(e) => set("type", e.target.value as JobType)}
            >
              {(Object.keys(JOB_TYPE_META) as JobType[]).map((t) => (
                <option key={t} value={t} className="bg-card">
                  {JOB_TYPE_META[t].label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="GPU tier">
            <select className={inputCls} value={form.gpuTier} onChange={(e) => onTier(e.target.value as GpuTier)}>
              {GPU_TIERS.map((g) => (
                <option key={g.value} value={g.value} className="bg-card">
                  {g.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Container image / model ref" error={errors.image}>
              <input
                className={cn(inputCls, "font-mono text-xs")}
                value={form.image}
                onChange={(e) => set("image", e.target.value)}
                placeholder="ghcr.io/org/image:tag"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Dataset URL" hint="optional">
              <input
                className={cn(inputCls, "font-mono text-xs")}
                value={form.datasetUrl}
                onChange={(e) => set("datasetUrl", e.target.value)}
                placeholder="s3://bucket/dataset.jsonl"
              />
            </Field>
          </div>

          <Field label="VRAM" hint="GB">
            <input
              type="number"
              min={0}
              className={cn(inputCls, "font-mono tabular-nums")}
              value={form.vram}
              onChange={(e) => set("vram", Number(e.target.value))}
            />
          </Field>

          <Field label="System RAM" hint="GB">
            <input
              type="number"
              min={0}
              className={cn(inputCls, "font-mono tabular-nums")}
              value={form.ram}
              onChange={(e) => set("ram", Number(e.target.value))}
            />
          </Field>

          <Field label="Max runtime" hint="minutes" error={errors.maxRuntimeMin}>
            <input
              type="number"
              min={1}
              className={cn(inputCls, "font-mono tabular-nums")}
              value={form.maxRuntimeMin}
              onChange={(e) => set("maxRuntimeMin", Number(e.target.value))}
            />
          </Field>

          <Field label="Replication factor" hint="nodes" error={errors.replication}>
            <input
              type="number"
              min={1}
              className={cn(inputCls, "font-mono tabular-nums")}
              value={form.replication}
              onChange={(e) => set("replication", Number(e.target.value))}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Reward bid"
              hint={`suggested ${est.suggestedBid.toLocaleString()} MYC`}
              error={errors.rewardBid}
            >
              <div className="relative">
                <Coins className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-primary" />
                <input
                  type="number"
                  min={0}
                  className={cn(inputCls, "pl-8 font-mono tabular-nums")}
                  value={form.rewardBid}
                  onChange={(e) => set("rewardBid", Number(e.target.value))}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                  MYC
                </span>
              </div>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="SLA tier" hint={tier !== "standard" ? `${SLA_MULTIPLIER[tier]}× price · priority scheduling` : "first-come scheduling"}>
              <select className={inputCls} value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
                {SLA_TIERS.map((t) => (
                  <option key={t} value={t} className="bg-card">
                    {t === "standard" ? "Standard" : t === "priority" ? `Priority (${SLA_MULTIPLIER.priority}× price)` : `Realtime (${SLA_MULTIPLIER.realtime}× price)`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* ---- live cost & time estimate ---- */}
      <div className="rounded-2xl border border-primary/20 bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Cpu className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Estimated cost &amp; time</h3>
          <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] text-tertiary">
            <span className="size-1.5 rounded-full bg-primary [animation:spore-pulse_2.4s_ease-in-out_infinite]" />
            live
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-tertiary">Est. cost</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-primary">
              {est.myc.toLocaleString()}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">MYC</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-tertiary">≈ USD</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
              ${est.usd.toLocaleString()}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">at spot rate</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-tertiary">
              <Clock className="size-3" />
              ETA
            </p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{est.minutes}</p>
            <p className="font-mono text-[10px] text-muted-foreground">minutes</p>
          </div>
        </div>

        <p className="mt-3 font-mono text-[10px] leading-relaxed text-tertiary">
          {/* Estimates come from the pricing oracle (network supply/demand + tier availability). */}
          Estimate reflects {form.gpuTier === "none" ? "CPU-only" : form.gpuTier} × {form.replication} node
          {form.replication > 1 ? "s" : ""} at current network rates.
        </p>
      </div>

      {/* ---- submit ---- */}
      <button
        type="button"
        disabled={!valid || submitting}
        onClick={submit}
        className={cn(
          "group flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
          valid && !submitting
            ? "bg-primary text-primary-foreground glow-teal hover:brightness-110"
            : "cursor-not-allowed bg-secondary text-tertiary",
        )}
      >
        <Send className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        {submitting ? "Submitting…" : result?.jobId ? "Job submitted to the mesh" : `Submit job · ${form.rewardBid.toLocaleString()} MYC`}
      </button>
      {result?.jobId && (
        <p className="text-center font-mono text-[11px] text-primary [animation:fade-in-up_0.4s_ease-out]">
          Escrow funded · job <span className="text-foreground">{result.jobId.slice(0, 8)}</span> fanned out to the mesh. Watch it render on the Network page.
        </p>
      )}
      {result?.error && (
        <p className="text-center font-mono text-[11px] text-destructive [animation:fade-in-up_0.4s_ease-out]">{result.error}</p>
      )}
    </section>
  )
}
