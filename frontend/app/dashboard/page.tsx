import type { Metadata } from "next"
import { AppShell } from "@/components/dashboard/app-shell"
import { StatCardRow } from "@/components/dashboard/stat-card"
import { NodeGrid } from "@/components/dashboard/node-grid"
import { EarningsChart } from "@/components/dashboard/earnings-chart"
import { EventLog } from "@/components/dashboard/event-log"
import { PowerControl } from "@/components/dashboard/power-control"
import { STAT_CARDS } from "@/lib/dashboard-data"

export const metadata: Metadata = {
  title: "Cultivator Dashboard — Mycelia",
  description:
    "Monitor your contributed nodes, live compute, earnings, and network activity across the Mycelia living compute network.",
}

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
        <div>
          <h1 className="font-display text-balance text-3xl font-normal tracking-tight text-foreground">
            Your corner of the living network
          </h1>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">
            Idle cycles, woven into the mesh. Here&apos;s what your nodes are fruiting right now.
          </p>
        </div>

        {/* top summary */}
        <StatCardRow stats={STAT_CARDS} />

        {/* devices */}
        <NodeGrid />

        {/* earnings + activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EarningsChart />
          </div>
          <EventLog />
        </div>

        {/* controls */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <PowerControl />
        </div>
      </div>
    </AppShell>
  )
}
