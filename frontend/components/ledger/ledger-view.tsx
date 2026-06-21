"use client"

import { useEffect, useState } from "react"
import { Coins, ArrowDownRight, ArrowUpRight, Lock, Landmark, Wallet } from "lucide-react"
import { usePoll } from "@/lib/api"
import { cn } from "@/lib/utils"

interface LedgerData {
  requester: { ledgerSum: number; available: number | null; reserved: number | null }
  platform: { ledgerSum: number; available: number | null; reserved: number | null }
  you: { ledgerSum: number; available: number | null; reserved: number | null }
  totals: { escrowHeld: number; paidToProviders: number; platformFees: number; refunded: number; entries: number }
  recent: Array<{ type: string; amount: number; memo: string | null; ts: number }>
}

const TYPE_META: Record<string, { label: string; tint: string }> = {
  escrow_hold: { label: "Escrow hold", tint: "text-status-idle" },
  escrow_release: { label: "Escrow release", tint: "text-primary" },
  provider_earn: { label: "Provider earn", tint: "text-primary" },
  platform_fee: { label: "Platform fee", tint: "text-accent" },
  refund: { label: "Refund", tint: "text-muted-foreground" },
  slash: { label: "Slash", tint: "text-destructive" },
}

function relTime(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.round(m / 60)}h ago`
}

function Stat({ icon: Icon, label, value, unit = "MYC", tint }: { icon: typeof Coins; label: string; value: number; unit?: string; tint?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
      <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        <Icon className={cn("size-4", tint ?? "text-primary")} strokeWidth={1.75} /> {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className={cn("font-mono text-2xl font-semibold tabular-nums", tint ?? "text-foreground")}>{value.toLocaleString("en-US")}</span>
        <span className="font-mono text-[11px] text-tertiary">{unit}</span>
      </span>
    </div>
  )
}

export function LedgerView() {
  const { data } = usePoll<LedgerData>("/api/ledger", 2000)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const t = data?.totals
  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-6">
      <div>
        <h1 className="font-display text-balance text-3xl font-normal tracking-tight text-foreground">Settlement &amp; earnings ledger</h1>
        <p className="mt-1 max-w-2xl text-pretty text-sm text-muted-foreground">
          Escrow-until-verified, end to end. Requester funds are held in escrow at submit and released to contributors
          only as each tile passes the deterministic self-check — append-only, idempotent, and overdraft-safe.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Wallet} label="Your earnings" value={data?.you.ledgerSum ?? 0} />
        <Stat icon={Lock} label="Escrow held" value={Math.abs(t?.escrowHeld ?? 0)} tint="text-status-idle" />
        <Stat icon={Coins} label="Paid to providers" value={t?.paidToProviders ?? 0} />
        <Stat icon={Landmark} label="Platform fees" value={t?.platformFees ?? 0} tint="text-accent" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* account balances */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-foreground">Account balances</h2>
          {[
            { k: "Requester (escrow account)", a: data?.requester },
            { k: "You (contributor)", a: data?.you },
            { k: "Platform", a: data?.platform },
          ].map((row) => (
            <div key={row.k} className="rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-xs font-medium text-foreground">{row.k}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="flex flex-col"><span className="text-tertiary">balance</span><span className="tabular-nums text-foreground">{(row.a?.ledgerSum ?? 0).toLocaleString()}</span></div>
                <div className="flex flex-col"><span className="text-tertiary">available</span><span className="tabular-nums text-primary">{row.a?.available != null ? row.a.available.toLocaleString() : "—"}</span></div>
                <div className="flex flex-col"><span className="text-tertiary">reserved</span><span className="tabular-nums text-status-idle">{row.a?.reserved != null ? row.a.reserved.toLocaleString() : "—"}</span></div>
              </div>
            </div>
          ))}
          <p className="font-mono text-[10px] leading-relaxed text-tertiary">
            available + reserved is conserved against the append-only ledger; concurrent overdraft is blocked by a
            per-account serialization row (PLAN.md §4).
          </p>
        </div>

        {/* recent entries */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Recent ledger entries</h2>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-tertiary">
              <span className="size-1.5 rounded-full bg-primary [animation:spore-pulse_2.4s_ease-in-out_infinite]" /> live · {t?.entries ?? 0} total
            </span>
          </div>
          <ul className="-mr-1 flex-1 divide-y divide-border overflow-y-auto pr-1" style={{ maxHeight: "28rem" }}>
            {(data?.recent ?? []).map((e, i) => {
              const meta = TYPE_META[e.type] ?? { label: e.type, tint: "text-muted-foreground" }
              const credit = e.amount >= 0
              return (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary", meta.tint)}>
                    {credit ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground"><span className="font-medium">{meta.label}</span>{e.memo ? <span className="text-muted-foreground"> · {e.memo}</span> : null}</p>
                    <p className="font-mono text-[10px] text-tertiary">{mounted ? relTime(e.ts) : " "}</p>
                  </div>
                  <span className={cn("font-mono text-sm tabular-nums", credit ? "text-primary" : "text-status-idle")}>{credit ? "+" : ""}{e.amount.toLocaleString()} <span className="text-[10px] text-tertiary">MYC</span></span>
                </li>
              )
            })}
            {(!data || data.recent.length === 0) && (
              <li className="py-8 text-center text-sm text-muted-foreground">No ledger activity yet — submit a job to fund escrow.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
