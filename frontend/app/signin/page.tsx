"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth"
import { auth, googleProvider, initAnalytics } from "@/lib/firebase"
import { MyceliumMark } from "@/components/mycelium-mark"
import { Store, Cpu, Layers, Mail, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

const ROLES = [
  { value: "requester", label: "Requester", icon: Store, blurb: "Submit compute jobs & pay from escrow" },
  { value: "provider", label: "Provider", icon: Cpu, blurb: "Contribute idle compute & earn MYC" },
  { value: "both", label: "Both", icon: Layers, blurb: "Submit jobs and contribute compute" },
] as const

type RoleValue = (typeof ROLES)[number]["value"]

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

const FIREBASE_ERRORS: Record<string, string> = {
  "auth/operation-not-allowed": "That sign-in method isn't enabled in the Firebase console yet.",
  "auth/popup-closed-by-user": "Sign-in popup was closed.",
  "auth/popup-blocked": "Popup blocked — allow popups and try again.",
  "auth/invalid-credential": "Wrong email or password.",
  "auth/invalid-email": "That email address looks invalid.",
  "auth/email-already-in-use": "That email already has an account — sign in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/unauthorized-domain": "This domain isn't authorized in Firebase Auth settings.",
}

export default function SignInPage() {
  const router = useRouter()
  const [role, setRole] = useState<RoleValue>("both")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [busy, setBusy] = useState<"google" | "email" | "demo" | null>(null)
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

  const withGoogle = async () => {
    if (busy) return
    setBusy("google")
    setError(null)
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      await establish(await cred.user.getIdToken())
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code !== "auth/popup-closed-by-user") setError(errMsg(e))
    } finally {
      setBusy(null)
    }
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
        <p className="mt-1 text-sm text-muted-foreground">Sign in with Firebase, then pick how you take part.</p>

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

        {/* Google */}
        <button
          onClick={withGoogle}
          disabled={!!busy}
          className="mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-secondary/40 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
        >
          <GoogleIcon className="size-4.5" />
          {busy === "google" ? "Opening Google…" : "Continue with Google"}
        </button>

        {/* divider */}
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary">or email</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* email/password */}
        <div className="space-y-2">
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
          className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
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
