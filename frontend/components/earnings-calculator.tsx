"use client"

import { useMemo, useState } from "react"
import { Cpu, Zap } from "lucide-react"

// GPU tiers — placeholder economics. Wire `mycPerHour` to the live
// marketplace rate feed and `watts` to measured device telemetry.
type Tier = {
  id: string
  label: string
  detail: string
  mycPerHour: number
  watts: number
}

const TIERS: Tier[] = [
  { id: "entry", label: "Entry", detail: "GTX-class · 8GB", mycPerHour: 1.4, watts: 160 },
  { id: "mid", label: "Mid", detail: "RTX-class · 12GB", mycPerHour: 3.2, watts: 250 },
  { id: "high", label: "High", detail: "RTX 4090 · 24GB", mycPerHour: 6.8, watts: 420 },
  { id: "pro", label: "Pro", detail: "H100 · 80GB", mycPerHour: 21.5, watts: 700 },
]

// economic assumptions (placeholder)
const MYC_TO_USD = 0.12 // 1 MYC ≈ $0.12
const ELECTRICITY_USD_PER_KWH = 0.17

export function EarningsCalculator() {
  const [tierIndex, setTierIndex] = useState(2)
  const [hours, setHours] = useState(8)

  const tier = TIERS[tierIndex]

  const { monthlyMyc, electricityUsd, netUsd } = useMemo(() => {
    const days = 30
    const monthlyMyc = tier.mycPerHour * hours * days
    const kwh = (tier.watts / 1000) * hours * days
    const electricityUsd = kwh * ELECTRICITY_USD_PER_KWH
    const grossUsd = monthlyMyc * MYC_TO_USD
    return { monthlyMyc, electricityUsd, netUsd: grossUsd - electricityUsd }
  }, [tier, hours])

  return (
    <section id="earnings" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            Earnings
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            See what your idle machine could fruit
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Estimates settle in MYC and convert at the live network rate. Your
            node only works when it&apos;s otherwise idle, so this is yield from
            hardware you already own.
          </p>
          <p className="mt-6 font-mono text-xs text-tertiary">
            Assumes 1 MYC ≈ ${MYC_TO_USD.toFixed(2)} · electricity $
            {ELECTRICITY_USD_PER_KWH.toFixed(2)}/kWh · 30-day month.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          {/* GPU tier */}
          <div className="mb-7">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Cpu className="size-4 text-primary" />
              GPU tier
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIERS.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTierIndex(i)}
                  aria-pressed={i === tierIndex}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    i === tierIndex
                      ? "border-primary/50 bg-primary/10"
                      : "border-border bg-secondary hover:border-primary/30"
                  }`}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {t.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] leading-tight text-muted-foreground">
                    {t.detail}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Hours per day */}
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between text-sm font-medium text-foreground">
              <span className="flex items-center gap-2">
                <Zap className="size-4 text-primary" />
                Idle hours / day
              </span>
              <span className="font-mono text-primary tabular-nums">{hours}h</span>
            </div>
            <input
              type="range"
              min={1}
              max={24}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              aria-label="Idle hours per day"
              className="myc-slider w-full"
            />
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-tertiary">
              <span>1h</span>
              <span>24h</span>
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 glow-teal">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Est. monthly
              </p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-primary tabular-nums">
                {monthlyMyc.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                <span className="ml-1 text-sm text-muted-foreground">MYC</span>
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Net after power
              </p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-foreground">
                ${netUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <p className="mt-1 font-mono text-[10px] text-tertiary">
                −${electricityUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} electricity
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
