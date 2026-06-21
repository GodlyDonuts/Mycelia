import { NextResponse } from "next/server"
import { getActiveRender } from "@/lib/reads"
import { startDriver } from "@/lib/driver"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  startDriver()
  return NextResponse.json(await getActiveRender())
}
