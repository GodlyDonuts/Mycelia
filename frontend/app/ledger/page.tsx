import type { Metadata } from "next"
import { AppShell } from "@/components/dashboard/app-shell"
import { LedgerView } from "@/components/ledger/ledger-view"

export const metadata: Metadata = {
  title: "Earnings & Settlement — Mycelia",
  description:
    "The Mycelia escrow-until-verified ledger: escrow held, paid to contributors, platform fees, account balances, and a live feed of ledger entries.",
}

export default function LedgerPage() {
  return (
    <AppShell active="Earnings" title="Earnings & Settlement" subtitle="ledger · live">
      <LedgerView />
    </AppShell>
  )
}
