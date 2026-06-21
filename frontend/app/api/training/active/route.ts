import { NextResponse } from "next/server"
import { getActiveTraining } from "@/lib/training/coordinator"
import { startTrainingDriver } from "@/lib/training/driver"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  startTrainingDriver()
  return NextResponse.json(await getActiveTraining())
}
