import { NextResponse } from "next/server"
import { getHealth } from "@/lib/health"
import { startDriver } from "@/lib/driver"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  startDriver()
  return NextResponse.json(await getHealth())
}
