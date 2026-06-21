import { NextResponse } from "next/server"
import { getNetwork } from "@/lib/reads"
import { startDriver } from "@/lib/driver"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  startDriver()
  return NextResponse.json(await getNetwork())
}
