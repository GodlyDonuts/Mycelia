import { NextResponse } from "next/server"
import { getDashboard } from "@/lib/reads"
import { startDriver } from "@/lib/driver"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  startDriver()
  return NextResponse.json(await getDashboard())
}
