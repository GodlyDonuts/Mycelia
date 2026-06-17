import { Button } from "@/components/ui/button"
import { MyceliumBackground } from "@/components/mycelium-background"
import { Hexagon, ArrowRight } from "lucide-react"

const COLUMNS: { heading: string; links: string[] }[] = [
  { heading: "Network", links: ["Status", "Marketplace", "Node map", "MYC economics"] },
  { heading: "Cultivators", links: ["Download agent", "Earnings", "Hardware guide", "Leaderboard"] },
  { heading: "Requesters", links: ["Submit a job", "Pricing", "API docs", "SDKs"] },
  { heading: "Company", links: ["About", "Manifesto", "Careers", "Contact"] },
]

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border">
      {/* subtle mycelium motif */}
      <MyceliumBackground className="absolute inset-0 h-full w-full opacity-20" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* CTA strip */}
        <div className="flex flex-col items-start justify-between gap-6 border-b border-border py-14 md:flex-row md:items-center">
          <div>
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Grow the network with us.
            </h2>
            <p className="mt-2 text-pretty text-muted-foreground">
              Spin up a node in minutes, or send your first job to the living cloud.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="group h-11 gap-2 bg-primary px-5 text-primary-foreground hover:bg-primary/90 glow-teal">
              Become a Cultivator
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button
              variant="outline"
              className="h-11 border-border bg-card/40 px-5 text-foreground hover:bg-card hover:text-foreground"
            >
              Submit a Job
            </Button>
          </div>
        </div>

        {/* Nav columns */}
        <div className="grid grid-cols-2 gap-8 py-14 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-8 items-center justify-center rounded-md bg-primary/10">
                <Hexagon className="size-5 text-primary" strokeWidth={1.5} />
                <span className="absolute size-1.5 rounded-full bg-primary [animation:spore-pulse_3s_ease-in-out_infinite]" />
              </span>
              <span className="font-mono text-sm font-semibold tracking-widest text-foreground">
                MYCELIA
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              One living compute cloud, grown from the machines the world already has.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border py-8 sm:flex-row">
          <p className="font-mono text-xs text-tertiary">
            © {new Date().getFullYear()} Mycelia Labs · The living compute network
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">Privacy</a>
            <a href="#" className="transition-colors hover:text-foreground">Terms</a>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-status-online [animation:spore-pulse_2.4s_ease-in-out_infinite]" />
              All systems nominal
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
