// STUN/TURN configuration for NAT traversal across consumer home networks.

export interface TurnServer {
  urls: string[]
  username: string
  credential: string
  region: string
}

export interface IceServerBundle {
  stun: string[]
  turn: TurnServer[]
}

export const DEFAULT_ICE_SERVERS: IceServerBundle = {
  stun: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
  turn: [
    {
      urls: ["turn:turn-us-east.mycelia.internal:3478", "turns:turn-us-east.mycelia.internal:5349"],
      username: "mycelia-relay",
      credential: "${MYCELIA_TURN_SECRET}",
      region: "us-east-1",
    },
    {
      urls: ["turn:turn-eu-west.mycelia.internal:3478"],
      username: "mycelia-relay",
      credential: "${MYCELIA_TURN_SECRET}",
      region: "eu-west-1",
    },
  ],
}

export function selectTurnForRegion(clientRegion: string, bundle: IceServerBundle = DEFAULT_ICE_SERVERS): TurnServer | null {
  const exact = bundle.turn.find((t) => t.region === clientRegion)
  if (exact) return exact
  return bundle.turn[0] ?? null
}

export function relayBandwidthBudget(mbps: number, activationBytes: number, rttMs: number): number {
  const rttSec = rttMs / 1000
  const pipeBytes = (mbps * 1e6 / 8) * rttSec
  return Math.floor(pipeBytes / Math.max(activationBytes, 1))
}
