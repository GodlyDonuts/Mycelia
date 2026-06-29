import { NextResponse } from "next/server"
import { cellQuorum, registerMember, resetMembership } from "@/lib/distributed/membership"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  resetMembership()
  const cellId = "cell-alpha"
  ;["n1", "n2", "n3"].forEach((id, i) =>
    registerMember({
      nodeId: id,
      cellId,
      stageIndex: i,
      health: "healthy",
      lastHeartbeat: Date.now(),
      capabilityScore: 100 - i * 10,
    }),
  )
  return NextResponse.json({
    protocol: "SWIM gossip + coordinator authority",
    quorum: cellQuorum(cellId),
    failureDetectionMs: 15000,
    stragglerPolicy: "eject after 2× p95 round latency",
    note: "Cell membership for pipeline stages; production integrates daemon heartbeats.",
  })
}
