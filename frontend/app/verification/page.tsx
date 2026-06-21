import type { Metadata } from "next"
import { AppShell } from "@/components/dashboard/app-shell"
import { VerificationView } from "@/components/verification/verification-view"

export const metadata: Metadata = {
  title: "Trust & Economics — Mycelia",
  description:
    "Mycelia's verification moat: stake-weighted spot-checking, reputation, slashing, the sellable fraction, and the live unit-economics that make the business close.",
}

export default function VerificationPage() {
  return (
    <AppShell active="Trust" title="Trust & Economics" subtitle="verification · live">
      <VerificationView />
    </AppShell>
  )
}
