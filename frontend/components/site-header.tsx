"use client"

import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Wordmark } from "@/components/mycelium-mark"
import { cn } from "@/lib/utils"

const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Earnings", href: "#earnings" },
  { label: "Workloads", href: "#workloads" },
  { label: "Network", href: "#stats" },
]

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Wordmark />

        <nav className="hidden items-center gap-9 md:flex" aria-label="Primary">
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

        <div className="flex items-center gap-1.5">
          <Link
            href="/signin"
            className={cn(buttonVariants({ variant: "ghost" }), "hidden text-muted-foreground hover:text-foreground sm:inline-flex")}
          >
            Sign in
          </Link>
          <Link
            href="/signin"
            className={cn(buttonVariants(), "bg-primary font-medium text-primary-foreground hover:bg-primary/90")}
          >
            Become a Cultivator
          </Link>
        </div>
      </div>
    </header>
  )
}
