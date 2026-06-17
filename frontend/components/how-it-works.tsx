import { Plug, Sprout, Coins } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Step = {
  icon: LucideIcon
  step: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: Plug,
    step: "01",
    title: "Connect",
    body: "Install the lightweight agent or join from your browser. Your machine becomes a node the moment it comes online — no configuration, no lock-in.",
  },
  {
    icon: Sprout,
    step: "02",
    title: "Contribute",
    body: "Donate the cycles you aren't using. The scheduler grows work toward idle capacity and retreats the instant you need your machine back.",
  },
  {
    icon: Coins,
    step: "03",
    title: "Earn",
    body: "Every completed slice of compute settles into MYC credits — redeemable, transferable, and proportional to the work your node fruited.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          How it works
        </p>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Three steps to grow the network
        </h2>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          A node is born, it fruits compute, it earns. The same loop, repeated
          across millions of machines, becomes one organism.
        </p>
      </div>

      <div className="mt-16 grid gap-5 md:grid-cols-3">
        {STEPS.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.step}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-7 transition-colors hover:border-primary/30"
            >
              <span className="absolute right-5 top-5 font-mono text-xs text-tertiary">
                {s.step}
              </span>
              <span className="flex size-12 items-center justify-center rounded-lg border border-border bg-secondary text-primary transition-shadow group-hover:glow-teal">
                <Icon className="size-6" strokeWidth={1.5} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
