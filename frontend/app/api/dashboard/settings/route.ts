import { NextResponse } from "next/server"
import { z } from "zod"
import { query, queryOne } from "@/lib/db"
import { DEMO_USER } from "@/lib/myc"
import { badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const Settings = z.object({
  contributionCapPct: z.number().int().min(50).max(100),
  onlyWhenIdle: z.boolean(),
})

export async function GET() {
  const row = await queryOne<{ contribution_cap_pct: number; only_when_idle: boolean }>(
    `SELECT contribution_cap_pct,only_when_idle FROM provider_settings WHERE user_id=$1`,
    [DEMO_USER],
  )
  return NextResponse.json({
    contributionCapPct: row?.contribution_cap_pct ?? 80,
    onlyWhenIdle: row?.only_when_idle ?? true,
  })
}

export async function POST(req: Request) {
  const parsed = Settings.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("invalid provider settings")
  const { contributionCapPct, onlyWhenIdle } = parsed.data
  await query(
    `INSERT INTO provider_settings(user_id,contribution_cap_pct,only_when_idle)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id) DO UPDATE SET contribution_cap_pct=$2,only_when_idle=$3,updated_at=now()`,
    [DEMO_USER, contributionCapPct, onlyWhenIdle],
  )
  return NextResponse.json({ ok: true, ...parsed.data })
}
