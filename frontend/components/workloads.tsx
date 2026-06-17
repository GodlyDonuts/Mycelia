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
    <section id="workloads" className="border-y border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            What you can run
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Built for work that loves to spread
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Anything that parallelizes thrives here — the network grows toward the
            work and reclaims itself when the job is done.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WORKLOADS.map((w) => {
            const Icon = w.icon
            return (
              <div
                key={w.title}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30"
              >
                <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
                  <Icon className="size-5" strokeWidth={1.5} />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {w.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {w.body}
                </p>
                <span className="mt-4 inline-block font-mono text-[10px] uppercase tracking-widest text-tertiary">
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
