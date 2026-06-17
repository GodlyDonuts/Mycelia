import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { StatsBand } from "@/components/stats-band"
import { HowItWorks } from "@/components/how-it-works"
import { EarningsCalculator } from "@/components/earnings-calculator"
import { Workloads } from "@/components/workloads"
import { SiteFooter } from "@/components/site-footer"

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <StatsBand />
        <HowItWorks />
        <EarningsCalculator />
        <Workloads />
      </main>
      <SiteFooter />
    </div>
  )
}
