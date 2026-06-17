"use client"

import { Button } from "@/components/ui/button"
import { Hexagon } from "lucide-react"

const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Earnings", href: "#earnings" },
  { label: "Workloads", href: "#workloads" },
  { label: "Network", href: "#stats" },
]

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#" className="flex items-center gap-2.5" aria-label="Mycelia home">
          <span className="relative flex size-8 items-center justify-center rounded-md bg-primary/10">
            <Hexagon className="size-5 text-primary" strokeWidth={1.5} />
            <span className="absolute size-1.5 rounded-full bg-primary [animation:spore-pulse_3s_ease-in-out_infinite]" />
          </span>
          <span className="font-mono text-sm font-semibold tracking-widest text-foreground">
            MYCELIA
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 glow-teal">
            Become a Cultivator
          </Button>
        </div>
      </div>
    </header>
  )
}
