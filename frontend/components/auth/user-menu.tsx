"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

interface User { name: string; role: "requester" | "provider" | "both" }

export function UserMenu() {
  const router = useRouter()
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
  }, [])

  if (user === undefined) return <span className="size-9 rounded-full bg-secondary" aria-hidden />
  if (!user) {
    return (
      <Link href="/signin" className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary">
        Sign in
      </Link>
    )
  }

  const initials = user.name.slice(0, 2).toUpperCase()
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <span className={cn("hidden rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide sm:inline",
        user.role === "provider" ? "bg-primary/10 text-primary" : user.role === "requester" ? "bg-accent/10 text-accent" : "bg-secondary text-muted-foreground")}>
        {user.role}
      </span>
      <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-foreground" title={user.name}>
        {initials}
      </span>
      <button onClick={logout} aria-label="Sign out" className="text-muted-foreground transition hover:text-foreground">
        <LogOut className="size-4" />
      </button>
    </div>
  )
}
