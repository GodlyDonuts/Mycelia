import { NextResponse } from "next/server"
import { getDb, getDbStatus } from "@/lib/db"
import { startDriver } from "@/lib/driver"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The AWS-integration proof surface: which database the app is actually bound to
// right now, plus the live connection telemetry (IAM token, TLS, keep-alive,
// 40001 retries, throughput). Awaiting getDb() forces the backend to resolve +
// connect, so opening this page brings the cluster up.
export async function GET() {
  startDriver()
  await getDb() // ensure the backend is resolved/connected before snapshotting
  const status = getDbStatus()
  return NextResponse.json({
    ...status,
    serverNow: Date.now(),
  })
}
