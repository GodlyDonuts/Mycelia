import { NextResponse } from "next/server"
import { getWallet } from "@/lib/wallet"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await getWallet())
}
