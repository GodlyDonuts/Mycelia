import { NextResponse } from "next/server"
import { DEFAULT_RENDER, computeTile, hashBytes } from "@/lib/fractal"
import { adaptiveReplicas, majorityVote } from "@/lib/replication"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Live N-of-M redundant-voting demo (PLAN §8): replicate a tile to 3 nodes — two
// honest (matching hashes) + one cheat (different hash) — and let the majority
// vote decide, flagging the dissenter for slashing.
export async function GET() {
  const idx = 21
  const honest = hashBytes(computeTile(DEFAULT_RENDER, idx))
  const bad = computeTile(DEFAULT_RENDER, idx).slice()
  bad[100] = (bad[100] + 50) & 255
  const cheatHash = hashBytes(bad)

  const vote = majorityVote([
    { nodeId: "n1", nodeName: "studio-rig", hash: honest },
    { nodeId: "n2", nodeName: "frankfurt-h100", hash: honest },
    { nodeId: "n3", nodeName: "node-cheat", hash: cheatHash },
  ])

  return NextResponse.json({
    replicasByReputation: { proven90: adaptiveReplicas(90), mid60: adaptiveReplicas(60), unproven20: adaptiveReplicas(20) },
    vote: { decisive: vote.decisive, agreers: vote.agreers, dissenters: vote.dissenters },
    flaggedForSlash: vote.dissenters,
    note: "Majority-hash voting when there's no cheap self-check; replica count adapts to reputation (the replication tax that drives the sellable fraction).",
  })
}
