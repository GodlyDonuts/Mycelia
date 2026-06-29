import { NextResponse } from "next/server"
import { saveCheckpoint, listCheckpoints, resetCheckpointStore } from "@/lib/training/checkpointing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  resetCheckpointStore()
  const adapter = Array.from({ length: 64 }, (_, i) => Math.cos(i * 0.1))
  saveCheckpoint(10, adapter)
  saveCheckpoint(20, adapter.map((x) => x * 0.99))
  return NextResponse.json({
    backend: "content-addressed blobs (S3 in production)",
    checkpoints: listCheckpoints(5),
    retention: { maxCheckpoints: 50, policy: "round-mod-100 + latest" },
    note: "Adapter + outer optimizer state for crash recovery and fork-resume.",
  })
}
