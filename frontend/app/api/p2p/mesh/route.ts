import { NextResponse } from "next/server"
import { createSession, meshTopology, concurrentSessions } from "@/lib/p2p/webrtc-mesh"
import { DEFAULT_ICE_SERVERS, selectTurnForRegion } from "@/lib/p2p/ice-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const offer = createSession("sess-demo", "node-a", "node-b")
  return NextResponse.json({
    signaling: "coordinator-mediated SDP exchange",
    iceServers: { stun: DEFAULT_ICE_SERVERS.stun.length, turn: DEFAULT_ICE_SERVERS.turn.length },
    turnForClient: selectTurnForRegion("eu-west-1")?.region,
    sampleOffer: { sessionId: offer.sessionId, protocol: offer.sdp.split("\r\n")[2] },
    pipelineLinks: meshTopology(3),
    concurrentSessions: concurrentSessions(12, 3),
    note: "WebRTC mesh for Regime-2 pipeline stages; TURN relay when direct ICE fails.",
  })
}
