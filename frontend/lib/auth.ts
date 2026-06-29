// Local auth + roles (PLAN §6 "Auth.js/Clerk with provider-vs-requester roles"),
// done without an external provider: an HMAC-signed, tamper-evident session
// cookie. Production swaps this for Auth.js/Clerk + OIDC — the role gating and
// session shape stay identical.

import { createHmac, timingSafeEqual } from "node:crypto"
import { DEMO_REQUESTER, DEMO_USER } from "./myc"

const SECRET = process.env.MYCELIA_SECRET || "mycelia-dev-secret-change-me"
export const SESSION_COOKIE = "mycelia_session"

export type Role = "requester" | "provider" | "both"
export interface Session {
  id: string
  name: string
  role: Role
  ts: number
  // Optional Firebase identity (present when signed in via Firebase Auth).
  email?: string
  picture?: string
  uid?: string
}

/** The account a role maps to (requester escrow account vs the contributor account). */
export function accountForRole(role: Role): string {
  return role === "requester" ? DEMO_REQUESTER : DEMO_USER
}

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url")
}

export function createSession(p: Session): string {
  const data = Buffer.from(JSON.stringify(p)).toString("base64url")
  return `${data}.${sign(data)}`
}

export function verifySession(token: string | undefined | null): Session | null {
  if (!token) return null
  const [data, sig] = token.split(".")
  if (!data || !sig) return null
  const expected = sign(data)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString()) as Session
  } catch {
    return null
  }
}

export function canSubmit(role: Role): boolean {
  return role === "requester" || role === "both"
}
