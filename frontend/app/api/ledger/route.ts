import { NextResponse } from "next/server"
import { getLedger } from "@/lib/reads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await getLedger())
}
