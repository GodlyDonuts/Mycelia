import { NextResponse } from "next/server"
import { z } from "zod"
import { createSession, accountForRole, SESSION_COOKIE, type Role, type Session } from "@/lib/auth"
import { verifyFirebaseIdToken } from "@/lib/firebase-verify"
import { badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Two ways in:
//  - { idToken, role }  → real Firebase identity; the ID token is verified
//    server-side against Google's keys before any session is issued.
//  - { name, role }     → the local demo path (no password), kept as a fallback.
const Body = z.object({
  role: z.enum(["requester", "provider", "both"]),
  idToken: z.string().min(20).optional(),
  name: z.string().min(1).max(60).optional(),
})

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("role + (idToken or name) required")
  const role = parsed.data.role as Role

  let session: Session
  if (parsed.data.idToken) {
    const identity = await verifyFirebaseIdToken(parsed.data.idToken)
    if (!identity) return NextResponse.json({ ok: false, error: "invalid_id_token" }, { status: 401 })
    const name = identity.name || identity.email?.split("@")[0] || "member"
    session = {
      id: accountForRole(role), // role → demo ledger account (economics unchanged)
      name,
      role,
      ts: Date.now(),
      email: identity.email ?? undefined,
      picture: identity.picture ?? undefined,
      uid: identity.uid,
    }
  } else if (parsed.data.name) {
    session = { id: accountForRole(role), name: parsed.data.name, role, ts: Date.now() }
  } else {
    return badRequest("provide a Firebase idToken or a display name")
  }

  const res = NextResponse.json({
    ok: true,
    user: { name: session.name, role: session.role, email: session.email ?? null, picture: session.picture ?? null },
  })
  res.cookies.set(SESSION_COOKIE, createSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
