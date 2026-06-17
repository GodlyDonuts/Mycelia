import { Button } from "@/components/ui/button"
import { MyceliumMark } from "@/components/mycelium-mark"
import { MyceliumBackground } from "@/components/mycelium-background"
import { ArrowRight } from "lucide-react"

const COLUMNS: { heading: string; links: string[] }[] = [
  { heading: "Network", links: ["Status", "Marketplace", "Node map", "MYC economics"] },
  { heading: "Cultivators", links: ["Download agent", "Earnings", "Hardware guide", "Leaderboard"] },
  { heading: "Requesters", links: ["Submit a job", "Pricing", "API docs", "SDKs"] },
  { heading: "Company", links: ["About", "Manifesto", "Careers", "Contact"] },
]

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border">
      <MyceliumBackground className="absolute inset-0 h-full w-full opacity-[0.12]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background/80 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* CTA strip */}
        <div className="flex flex-col items-start justify-between gap-8 border-b border-border py-16 md:flex-row md:items-end">
          <div>
            <h2 className="font-display max-w-md text-balance text-3xl font-normal leading-[1.1] text-foreground sm:text-4xl">
              Grow the network with us.
            </h2>
            <p className="mt-3 text-pretty text-muted-foreground">
              Spin up a node in minutes, or send your first job to the living cloud.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="group h-11 gap-2 bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90">
              Become a Cultivator
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button
              variant="ghost"
              className="h-11 px-5 text-foreground hover:bg-secondary"
            >
              Submit a job
            </Button>
          </div>
        </div>

        {/* Nav columns */}
        <div className="grid grid-cols-2 gap-8 py-16 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <MyceliumMark className="text-foreground" size={20} />
              <span className="font-display text-[17px] tracking-[-0.01em] text-foreground">
                Mycelia
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              One living compute cloud, grown from the machines the world already has.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-tertiary">
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
              <span className="size-1.5 rounded-full bg-status-online [animation:spore-pulse_2.6s_ease-in-out_infinite]" />
              All systems nominal
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
