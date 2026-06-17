import type { Metadata } from "next"
import { AppShell } from "@/components/dashboard/app-shell"
import { JobBoard } from "@/components/marketplace/job-board"
import { SubmitJob } from "@/components/marketplace/submit-job"

export const metadata: Metadata = {
  title: "Marketplace — Mycelia",
  description:
    "Browse the live compute job board and submit render, inference, simulation, and LoRA fine-tune jobs to the Mycelia living network.",
}

export default function MarketplacePage() {
  return (
    <AppShell active="Marketplace" title="Compute Marketplace" subtitle="job board · live">
      <div className="mx-auto flex max-w-[110rem] flex-col gap-6">
        <div>
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
            Put the living network to work
          </h1>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">
            Claim a job from the board, or describe what you need in plain English and let Mycelia shape it into a
            runnable spec.
          </p>
        </div>

        {/* two-pane responsive layout: job board (left) · submit (right) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_28rem] xl:grid-cols-[minmax(0,1fr)_32rem]">
          {/* LEFT — available / your jobs */}
          <div className="order-2 lg:order-1">
            <JobBoard />
          </div>

          {/* RIGHT — submit a job (sticky on large screens) */}
          <div className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-20">
              <SubmitJob />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
