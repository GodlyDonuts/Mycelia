import { NextResponse } from "next/server"
import { REGIONS, regionPayout } from "@/lib/regions"
import { getVerification } from "@/lib/verification"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Region-aware payouts at the current network sellable fraction + the live UTC
// hour (so off-peak windows light up in real time).
export async function GET() {
  const v = await getVerification()
  const sellable = v.sellableFraction / 100
  const utcHour = new Date().getUTCHours()
  const regions = REGIONS.map((r) => regionPayout(r, sellable, utcHour)).sort((a, b) => b.net - a.net)
  return NextResponse.json({ utcHour, sellableFraction: v.sellableFraction, regions })
}
