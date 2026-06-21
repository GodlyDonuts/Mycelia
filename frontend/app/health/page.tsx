import type { Metadata } from "next"
import { AppShell } from "@/components/dashboard/app-shell"
import { HealthStrip } from "@/components/health/health-strip"

export const metadata: Metadata = {
  title: "Health — Mycelia",
  description: "On-stage health strip: ledger reconciliation sweep, render/training status, mesh liveness, and the trust counters.",
}

export default function HealthPage() {
  return (
    <AppShell active="Health" title="On-stage Health" subtitle="runbook · live">
      <HealthStrip />
    </AppShell>
  )
}
