"use client"

import { useState } from "react"
import { Banknote, Gift, Bitcoin, Wallet } from "lucide-react"
import { usePoll } from "@/lib/api"
import { cn } from "@/lib/utils"

interface WalletData {
  balance: number
  balanceUsd: number
  totalEarned: number
  totalRedeemed: number
  history: Array<{ amount: number; usd: number; memo: string | null; ts: number }>
}

const METHODS = [
  { value: "bank", label: "Bank", icon: Banknote },
  { value: "giftcard", label: "Gift card", icon: Gift },
  { value: "crypto", label: "Crypto", icon: Bitcoin },
] as const

export function RedeemPanel() {
  const { data } = usePoll<WalletData>("/api/wallet", 4000)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("bank")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const redeem = async () => {
    const amt = Number(amount)
    if (!(amt > 0) || busy) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/wallet/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: amt, method }),
      }).then((x) => x.json())
      if (r.ok) {
        setMsg({ ok: true, text: `Cashing out ${r.redeemed.toLocaleString()} MYC (≈ $${r.usd}) via ${r.method}.` })
        setAmount("")
      } else {
        setMsg({ ok: false, text: r.error === "INSUFFICIENT_BALANCE" ? "Amount exceeds your MYC balance." : r.error })
      }
    } catch {
      setMsg({ ok: false, text: "Network error." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="size-4 text-primary" />
        <h2 className="text-sm font-medium text-foreground">Redeem MYC</h2>
        <span className="ml-auto font-mono text-[11px] text-tertiary">internal credit → cash-out</span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-tertiary">redeemable balance</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{(data?.balance ?? 0).toLocaleString()} <span className="text-sm text-tertiary">MYC</span></p>
            <p className="font-mono text-[11px] text-muted-foreground">≈ ${(data?.balanceUsd ?? 0).toLocaleString()} USD · earned {(data?.totalEarned ?? 0).toLocaleString()} · redeemed {(data?.totalRedeemed ?? 0).toLocaleString()}</p>
          </div>

          <div className="mt-3 flex gap-2">
            {METHODS.map((m) => {
              const Icon = m.icon
              return (
                <button key={m.value} onClick={() => setMethod(m.value)}
                  className={cn("flex flex-1 flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] transition-colors",
                    method === m.value ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground")}>
                  <Icon className="size-4" /> {m.label}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="amount in MYC"
              className="h-10 flex-1 rounded-lg border border-input bg-secondary/50 px-3 font-mono text-sm text-foreground placeholder:text-tertiary outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
            <button onClick={() => setAmount(String(data?.balance ?? 0))} className="rounded-lg border border-border bg-secondary/40 px-3 text-xs text-muted-foreground hover:text-foreground">max</button>
          </div>
          <button onClick={redeem} disabled={busy || !(Number(amount) > 0)}
            className="mt-3 h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
            {busy ? "Processing…" : "Cash out"}
          </button>
          {msg && <p className={cn("mt-2 text-center font-mono text-[11px]", msg.ok ? "text-primary" : "text-destructive")}>{msg.text}</p>}
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-tertiary">
            Redemptions are taxable income; KYC/AML applies above thresholds. Gift-card/crypto on-ramp (Salad-style). MYC
            is an internal stable-value credit — no tradeable token at launch. Demo: no real funds move.
          </p>
        </div>

        <div>
          <p className="mb-2 font-mono text-[11px] text-tertiary">recent cash-outs</p>
          <ul className="divide-y divide-border">
            {(data?.history ?? []).map((h, i) => (
              <li key={i} className="flex items-center justify-between py-2 font-mono text-[12px]">
                <span className="text-muted-foreground">{h.memo ?? "redeem"}</span>
                <span className="tabular-nums text-foreground">{h.amount.toLocaleString()} MYC <span className="text-tertiary">· ${h.usd}</span></span>
              </li>
            ))}
            {(!data || data.history.length === 0) && <li className="py-6 text-center font-mono text-[11px] text-tertiary">No cash-outs yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}
