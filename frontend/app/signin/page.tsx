"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MyceliumMark } from "@/components/mycelium-mark"
import { Store, Cpu, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

const ROLES = [
  { value: "requester", label: "Requester", icon: Store, blurb: "Submit compute jobs & pay from escrow" },
  { value: "provider", label: "Provider", icon: Cpu, blurb: "Contribute idle compute & earn MYC" },
  { value: "both", label: "Both", icon: Layers, blurb: "Submit jobs and contribute compute" },
] as const

export default function SignInPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [role, setRole] = useState<"requester" | "provider" | "both">("both")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), role }),
    })
    router.push(role === "requester" ? "/marketplace" : "/dashboard")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7">
        <Link href="/" className="mb-6 flex items-center gap-2.5">
          <MyceliumMark className="text-foreground" size={22} />
          <span className="font-display text-lg tracking-tight text-foreground">Mycelia</span>
        </Link>
        <h1 className="font-display text-2xl font-normal text-foreground">Join the network</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick how you want to take part. (Local demo auth — no password.)</p>

        <label className="mt-6 block">
          <span className="text-xs font-medium text-muted-foreground">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. ada-lovelace"
            className="mt-1.5 h-10 w-full rounded-lg border border-input bg-secondary/50 px-3 text-sm text-foreground placeholder:text-tertiary outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </label>

        <div className="mt-4 space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Role</span>
          {ROLES.map((r) => {
            const Icon = r.icon
            const active = role === r.value
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  active ? "border-primary/40 bg-primary/10" : "border-border bg-secondary/30 hover:border-primary/20",
                )}
              >
                <Icon className={cn("size-5", active ? "text-primary" : "text-tertiary")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-[11px] text-muted-foreground">{r.blurb}</p>
                </div>
                <span className={cn("size-3 rounded-full border", active ? "border-primary bg-primary" : "border-tertiary")} />
              </button>
            )
          })}
        </div>

        <button
          onClick={submit}
          disabled={!name.trim() || busy}
          className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Continue"}
        </button>
      </div>
    </div>
  )
}
