import { NextResponse } from "next/server"
import { z } from "zod"
import { createSession, accountForRole, SESSION_COOKIE, type Role } from "@/lib/auth"
import { badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Body = z.object({ name: z.string().min(1).max(60), role: z.enum(["requester", "provider", "both"]) })

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("name + role required")
  const role = parsed.data.role as Role
  const session = { id: accountForRole(role), name: parsed.data.name, role, ts: Date.now() }
  const res = NextResponse.json({ ok: true, user: { name: session.name, role: session.role } })
  res.cookies.set(SESSION_COOKIE, createSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
