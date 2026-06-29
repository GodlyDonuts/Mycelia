"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  Store,
  Network,
  Wallet,
  ShieldCheck,
  Activity,
  Cloud,
  Settings,
  Menu,
  X,
  Coins,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePoll } from "@/lib/api"
import { MyceliumMark } from "@/components/mycelium-mark"
import { UserMenu } from "@/components/auth/user-menu"

type NavItem = { label: string; icon: typeof LayoutDashboard; href: string }

const NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Marketplace", icon: Store, href: "/marketplace" },
  { label: "Network", icon: Network, href: "/network" },
  { label: "Trust", icon: ShieldCheck, href: "/verification" },
  { label: "Earnings", icon: Wallet, href: "/ledger" },
  { label: "Health", icon: Activity, href: "/health" },
  { label: "Cloud", icon: Cloud, href: "/cloud" },
]

function NavList({ active = "Dashboard", onNavigate }: { active?: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {NAV.map((item) => {
        const Icon = item.icon
        const isActive = item.label === active
        return (
          <a
            key={item.label}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4.5 transition-colors",
                isActive ? "text-primary" : "text-tertiary group-hover:text-foreground",
              )}
              strokeWidth={1.75}
            />
            <span className={isActive ? "font-medium" : ""}>{item.label}</span>
            {isActive && (
              <span className="ml-auto size-1.5 rounded-full bg-primary [animation:spore-pulse_3s_ease-in-out_infinite]" />
            )}
          </a>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <a href="/" className="flex items-center gap-2.5" aria-label="Mycelia home">
      <MyceliumMark className="text-foreground" size={20} />
      <span className="font-display text-[17px] tracking-[-0.01em] text-foreground">Mycelia</span>
    </a>
  )
}

/** Topbar MYC credit balance — live "your" earnings from the ledger. */
function CreditBalance() {
  const { data } = usePoll<{ totalEarnings: number }>("/api/dashboard", 2000)
  const balance = (data?.totalEarnings ?? 48210).toLocaleString("en-US")
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-1.5">
      <Coins className="size-4 text-primary" strokeWidth={1.75} />
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{balance}</span>
      <span className="font-mono text-xs text-muted-foreground">MYC</span>
    </div>
  )
}

export function AppShell({
  children,
  active = "Dashboard",
  title = "Cultivator Dashboard",
  subtitle = "node mesh · live",
}: {
  children: React.ReactNode
  active?: string
  title?: string
  subtitle?: string
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---- Desktop sidebar ---- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavList active={active} />
        </div>
        <div className="border-t border-border px-3 py-4">
          <a
            href="#"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Settings className="size-4.5 text-tertiary" strokeWidth={1.75} />
            Settings
          </a>
        </div>
      </aside>

      {/* ---- Mobile drawer ---- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-sidebar">
            <div className="flex h-16 items-center justify-between border-b border-border px-6">
              <Brand />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-5">
              <NavList active={active} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* ---- Main column ---- */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="text-muted-foreground hover:text-foreground lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden flex-col sm:flex">
              <span className="text-sm font-medium text-foreground">{title}</span>
              <span className="font-mono text-[11px] text-tertiary">{subtitle}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <CreditBalance />
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Bell className="size-4.5" strokeWidth={1.75} />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
            </button>
            <UserMenu />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
