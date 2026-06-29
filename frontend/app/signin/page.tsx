"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"
import { auth, initAnalytics } from "@/lib/firebase"
import { MyceliumMark } from "@/components/mycelium-mark"
import { Store, Cpu, Layers, Mail, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

const ROLES = [
  { value: "requester", label: "Requester", icon: Store, blurb: "Submit compute jobs & pay from escrow" },
  { value: "provider", label: "Provider", icon: Cpu, blurb: "Contribute idle compute & earn MYC" },
  { value: "both", label: "Both", icon: Layers, blurb: "Submit jobs and contribute compute" },
] as const

type RoleValue = (typeof ROLES)[number]["value"]

const FIREBASE_ERRORS: Record<string, string> = {
  "auth/operation-not-allowed": "Email/password sign-in isn't enabled in the Firebase console yet.",
  "auth/invalid-credential": "Wrong email or password.",
  "auth/invalid-email": "That email address looks invalid.",
  "auth/email-already-in-use": "That email already has an account — sign in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts — wait a moment and try again.",
  "auth/unauthorized-domain": "This domain isn't authorized in Firebase Auth settings.",
}

export default function SignInPage() {
  const router = useRouter()
  const [role, setRole] = useState<RoleValue>("both")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [busy, setBusy] = useState<"email" | "demo" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDemo, setShowDemo] = useState(false)
  const [demoName, setDemoName] = useState("")

  useEffect(() => {
    void initAnalytics()
  }, [])

  const go = () => {
    router.push(role === "requester" ? "/marketplace" : "/dashboard")
    router.refresh()
  }

  /** Exchange a verified Firebase ID token for the app session cookie. */
  const establish = async (idToken: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken, role }),
    })
    if (!res.ok) throw new Error("Session exchange failed — please retry.")
    go()
  }

  const errMsg = (e: unknown): string => {
    const code = (e as { code?: string })?.code
    if (code && FIREBASE_ERRORS[code]) return FIREBASE_ERRORS[code]
    return e instanceof Error ? e.message : "Something went wrong."
  }

  const withEmail = async () => {
    if (busy || !email.trim() || password.length < 6) return
    setBusy("email")
    setError(null)
    try {
      const cred =
        mode === "signup"
          ? await createUserWithEmailAndPassword(auth, email.trim(), password)
          : await signInWithEmailAndPassword(auth, email.trim(), password)
      await establish(await cred.user.getIdToken())
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const withDemo = async () => {
    if (busy || !demoName.trim()) return
    setBusy("demo")
    setError(null)
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: demoName.trim(), role }),
      })
      go()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7">
        <Link href="/" className="mb-6 flex items-center gap-2.5">
          <MyceliumMark className="text-foreground" size={22} />
          <span className="font-display text-lg tracking-tight text-foreground">Mycelia</span>
        </Link>
        <h1 className="font-display text-2xl font-normal text-foreground">Join the network</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signup" ? "Create an account, then pick how you take part." : "Sign in with email, then pick how you take part."}
        </p>

        {/* role */}
        <div className="mt-6 space-y-2">
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

        {/* email/password */}
        <div className="mt-6 space-y-2">
          <span className="text-xs font-medium text-muted-foreground">{mode === "signup" ? "New account" : "Email"}</span>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-secondary/50 px-3 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
            <Mail className="size-4 text-tertiary" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-tertiary outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-secondary/50 px-3 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
            <Lock className="size-4 text-tertiary" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && withEmail()}
              placeholder="password (6+ chars)"
              className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-tertiary outline-none"
            />
          </div>
        </div>

        <button
          onClick={withEmail}
          disabled={!!busy || !email.trim() || password.length < 6}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy === "email" ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"))
            setError(null)
          }}
          className="mt-2 w-full text-center text-xs text-muted-foreground transition hover:text-foreground"
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg border border-status-offline/40 bg-status-offline/5 px-3 py-2 text-[12px] text-status-offline">{error}</p>
        )}

        {/* demo fallback */}
        <div className="mt-6 border-t border-border pt-4">
          {!showDemo ? (
            <button onClick={() => setShowDemo(true)} className="w-full text-center text-[11px] text-tertiary transition hover:text-muted-foreground">
              or continue with a demo name (no password)
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                value={demoName}
                onChange={(e) => setDemoName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && withDemo()}
                placeholder="e.g. ada-lovelace"
                className="h-10 flex-1 rounded-lg border border-input bg-secondary/50 px-3 text-sm text-foreground placeholder:text-tertiary outline-none focus:border-primary/50"
              />
              <button
                onClick={withDemo}
                disabled={!!busy || !demoName.trim()}
                className="h-10 rounded-lg border border-border bg-secondary/50 px-4 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
              >
                {busy === "demo" ? "…" : "Continue"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
