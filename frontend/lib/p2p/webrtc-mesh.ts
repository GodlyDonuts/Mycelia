// WebRTC mesh coordinator for pipeline-stage peers (PLAN Phase 4 — P2P activations).
// Signaling goes through the coordinator; media/data is peer-to-peer with TURN relay.

export type IceConnectionState = "new" | "checking" | "connected" | "disconnected" | "failed" | "closed"

export interface SignalingOffer {
  sessionId: string
  fromNode: string
  toNode: string
  sdp: string
  iceCandidates: string[]
}

export interface DataChannelConfig {
  label: string
  ordered: boolean
  maxRetransmits: number
  protocol: "activation-v1" | "gradient-v1"
}

export const DEFAULT_DC_CONFIG: DataChannelConfig = {
  label: "mycelia-activation",
  ordered: true,
  maxRetransmits: 3,
  protocol: "activation-v1",
}

const sessions = new Map<string, { state: IceConnectionState; peers: [string, string] }>()

export function resetMeshSessions(): void {
  sessions.clear()
}

export function createSession(sessionId: string, a: string, b: string): SignalingOffer {
  sessions.set(sessionId, { state: "new", peers: [a, b] })
  return {
    sessionId,
    fromNode: a,
    toNode: b,
    sdp: `v=0\r\no=mycelia ${Date.now()} 1 IN IP4 0.0.0.0\r\ns=mycelia-pipeline\r\n`,
    iceCandidates: [`candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host`],
  }
}

export function advanceIceState(sessionId: string, next: IceConnectionState): boolean {
  const s = sessions.get(sessionId)
  if (!s) return false
  s.state = next
  return true
}

export function meshTopology(stageCount: number): number {
  // pipeline: (stageCount - 1) links
  return Math.max(0, stageCount - 1)
}

export function concurrentSessions(cells: number, stagesPerCell: number): number {
  return cells * meshTopology(stagesPerCell)
}
