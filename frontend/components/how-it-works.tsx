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
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-28 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-5 inline-flex items-center gap-2">
          <span className="size-1 rounded-full bg-primary" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            How it works
          </span>
        </div>
        <h2 className="font-display text-balance text-4xl font-normal leading-[1.1] text-foreground sm:text-[2.75rem]">
          Three steps to grow the network
        </h2>
        <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
          A node is born, it fruits compute, it earns. The same loop, repeated across
          millions of machines, becomes one organism.
        </p>
      </div>

      <div className="mt-16 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
        {STEPS.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.step}
              className="relative bg-card p-8 transition-colors hover:bg-card/60"
            >
              <span className="absolute right-6 top-6 font-mono text-xs text-tertiary">
                {s.step}
              </span>
              <span className="flex size-11 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
                <Icon className="size-5" strokeWidth={1.5} />
              </span>
              <h3 className="mt-6 text-lg font-medium text-foreground">{s.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
