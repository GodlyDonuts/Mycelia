"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileJson, Upload, Sparkles, Cpu, ArrowRight, Loader2, CircleCheck, CircleAlert, Layers, Database } from "lucide-react"
import { parseNotebook, SAMPLE_NOTEBOOK, type ParsedNotebook } from "@/lib/notebook"
import { cn } from "@/lib/utils"

type Phase = "empty" | "parsed" | "submitting" | "done" | "error"

function Stat({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-wider text-tertiary">{label}</p>
        <p className="truncate font-mono text-[12px] text-foreground">{value}</p>
      </div>
    </div>
  )
}

export function NotebookSubmit() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>("empty")
  const [nb, setNb] = useState<ParsedNotebook | null>(null)
  const [filename, setFilename] = useState<string>("")
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  const ingest = (text: string, name: string) => {
    try {
      const parsed = parseNotebook(text, name)
      setNb(parsed)
      setFilename(name)
      setPhase("parsed")
      setError(null)
    } catch {
      setError("That doesn't look like a valid .ipynb file.")
      setPhase("error")
    }
  }

  const onFile = (file: File) => {
    if (!file.name.endsWith(".ipynb")) {
      setError("Please choose a Jupyter .ipynb notebook.")
      setPhase("error")
      return
    }
    const reader = new FileReader()
    reader.onload = () => ingest(String(reader.result), file.name)
    reader.onerror = () => {
      setError("Couldn't read that file.")
      setPhase("error")
    }
    reader.readAsText(file)
  }

  const useSample = () => ingest(SAMPLE_NOTEBOOK, "lora-finetune-support.ipynb")

  const distribute = async () => {
    if (!nb) return
    setPhase("submitting")
    setError(null)
    try {
      // Epochs map to aggregation rounds; keep enough rounds for a rich curve.
      const maxRounds = Math.min(60, Math.max(12, nb.epochs * 8))
      const res = await fetch("/api/training/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: nb.title,
          baseModel: nb.baseModel,
          dataset: nb.dataset,
          rank: nb.rank,
          maxRounds,
          rewardBid: 1200,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setJobId(data.jobId)
        setPhase("done")
      } else {
        setError(data.error === "INSUFFICIENT_FUNDS" ? "Not enough MYC in escrow for this run." : data.error || "Submit failed.")
        setPhase("error")
      }
    } catch {
      setError("Network error — could not reach the training coordinator.")
      setPhase("error")
    }
  }

  const reset = () => {
    setNb(null)
    setFilename("")
    setJobId(null)
    setError(null)
    setPhase("empty")
  }

  return (
    <section aria-label="Submit a Jupyter notebook" className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <FileJson className="size-4 text-primary" strokeWidth={1.75} />
          <h2 className="text-sm font-semibold text-foreground">Run a Jupyter notebook on the mesh</h2>
        </div>
        <p className="mb-4 text-[12px] text-muted-foreground">
          Drop a training notebook — Mycelia reads it, shards the work, and fans the run out across contributor GPUs.
        </p>

        {/* ---- dropzone (empty / error) ---- */}
        {(phase === "empty" || phase === "error") && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files?.[0]
                if (f) onFile(f)
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:border-primary/40",
              )}
            >
              <span className={cn("flex size-12 items-center justify-center rounded-2xl", dragOver ? "bg-primary/20 text-primary" : "bg-secondary text-tertiary")}>
                <Upload className="size-6" strokeWidth={1.6} />
              </span>
              <span className="text-sm font-medium text-foreground">Drop your <span className="font-mono text-primary">.ipynb</span> here</span>
              <span className="font-mono text-[11px] text-tertiary">or click to browse</span>
            </button>
            <input ref={inputRef} type="file" accept=".ipynb,application/x-ipynb+json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

            {error && (
              <p className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-destructive">
                <CircleAlert className="size-3.5" /> {error}
              </p>
            )}

            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <button onClick={useSample} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 font-mono text-[11px] text-primary transition hover:bg-primary/10">
                <Sparkles className="size-3.5" /> use a sample notebook
              </button>
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        {/* ---- parsed summary ---- */}
        {(phase === "parsed" || phase === "submitting") && nb && (
          <div className="flex flex-col gap-4 [animation:fade-in-up_0.4s_ease-out]">
            <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
              <FileJson className="size-4 text-primary" />
              <span className="truncate font-mono text-[12px] text-foreground">{filename}</span>
              <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-primary">
                <CircleCheck className="size-3.5" /> parsed · {nb.cells.length} cells
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Stat icon={Cpu} label="base model" value={nb.baseModel} />
              <Stat icon={Layers} label="adapter" value={`LoRA · rank ${nb.rank}`} />
              <Stat icon={Database} label="dataset" value={nb.dataset} />
              <Stat icon={Sparkles} label="framework" value={nb.framework} />
            </div>

            {/* code preview */}
            <div className="overflow-hidden rounded-xl border border-border bg-[#0b0b0a]">
              <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
                <span className="size-2 rounded-full bg-status-offline/60" />
                <span className="size-2 rounded-full bg-status-idle/60" />
                <span className="size-2 rounded-full bg-primary/60" />
                <span className="ml-2 font-mono text-[10px] text-tertiary">{nb.codeLines} lines · {nb.epochs} epochs</span>
              </div>
              <pre className="max-h-40 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {nb.cells.filter((c) => c.type === "code").slice(0, 3).map((c) => c.source).join("\n\n") || "# (no code cells)"}
              </pre>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={distribute}
                disabled={phase === "submitting"}
                className="group flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-all glow-teal hover:brightness-110 disabled:opacity-60"
              >
                {phase === "submitting" ? <Loader2 className="size-4 animate-spin" /> : <Cpu className="size-4" strokeWidth={2} />}
                {phase === "submitting" ? "Sharding & dispatching…" : "Distribute across the mesh"}
              </button>
              <button onClick={reset} disabled={phase === "submitting"} className="h-11 rounded-xl border border-border bg-secondary/50 px-4 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50">
                Clear
              </button>
            </div>
          </div>
        )}

        {/* ---- done ---- */}
        {phase === "done" && nb && (
          <div className="flex flex-col items-center gap-4 py-4 text-center [animation:fade-in-up_0.4s_ease-out]">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <CircleCheck className="size-7" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Dispatched to the mesh</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                <span className="text-foreground">{nb.title}</span> · escrow funded · job {jobId?.slice(0, 8)} fanning out into training cells.
              </p>
            </div>
            <button
              onClick={() => router.push("/network")}
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
            >
              Watch it train across the network
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button onClick={reset} className="font-mono text-[11px] text-tertiary transition hover:text-muted-foreground">
              submit another notebook
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
