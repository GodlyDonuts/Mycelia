// Small HTTP hardening helpers: an in-memory token-bucket rate limiter and
// consistent error responses (PLAN §6 "rate-limiting + abuse checks on the
// public job-submit endpoint"). The bucket is per-process — fine for the local
// demo / a single instance; on multi-instance serverless this graduates to a
// shared store (Upstash/DSQL), noted in the roadmap.

import { NextResponse } from "next/server"

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) }
  b.count++
  return { ok: true, retryAfter: 0 }
}

export function clientId(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  return xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local"
}

export function tooMany(retryAfter: number) {
  return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "retry-after": String(retryAfter) } })
}

export function badRequest(error: unknown) {
  const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "bad request"
  return NextResponse.json({ ok: false, error: msg }, { status: 400 })
}
