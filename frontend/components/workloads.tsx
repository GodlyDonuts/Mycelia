import { Box, BrainCircuit, Atom, Layers } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Workload = {
  icon: LucideIcon
  title: string
  body: string
  tag: string
}

const WORKLOADS: Workload[] = [
  {
    icon: Box,
    title: "Rendering",
    body: "Distribute frames and bake light across thousands of nodes at once.",
    tag: "render",
  },
  {
    icon: BrainCircuit,
    title: "Batched AI inference",
    body: "Fan out high-throughput inference for models that don't need a single host.",
    tag: "inference",
  },
  {
    icon: Atom,
    title: "Scientific sims",
    body: "Molecular dynamics, climate models, Monte Carlo — embarrassingly parallel by nature.",
    tag: "compute",
  },
  {
    icon: Layers,
    title: "LoRA fine-tuning",
    body: "Train adapters and run sweeps across the network's pooled GPU memory.",
    tag: "training",
  },
]

export function Workloads() {
  return (
    <section id="workloads" className="border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-28 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2">
            <span className="size-1 rounded-full bg-primary" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              What you can run
            </span>
          </div>
          <h2 className="font-display text-balance text-4xl font-normal leading-[1.1] text-foreground sm:text-[2.75rem]">
            Built for work that loves to spread
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
            Anything that parallelizes thrives here — the network grows toward the work
            and reclaims itself when the job is done.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WORKLOADS.map((w) => {
            const Icon = w.icon
            return (
              <div
                key={w.title}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-border/0 hover:bg-secondary/60"
              >
                <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
                  <Icon className="size-5" strokeWidth={1.5} />
                </span>
                <h3 className="mt-5 text-base font-medium text-foreground">
                  {w.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {w.body}
                </p>
                <span className="mt-5 inline-block font-mono text-[10px] uppercase tracking-[0.18em] text-tertiary">
                  /{w.tag}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
