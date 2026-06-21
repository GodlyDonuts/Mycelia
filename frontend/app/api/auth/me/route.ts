import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const store = await cookies()
  const session = verifySession(store.get(SESSION_COOKIE)?.value)
  return NextResponse.json({ user: session ? { name: session.name, role: session.role } : null })
}
