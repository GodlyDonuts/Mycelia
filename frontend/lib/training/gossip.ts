// Gossip-based delta propagation for WAN-unfriendly topologies (fallback when
// coordinator is unreachable). Epidemic broadcast with anti-entropy rounds.

export interface GossipMessage {
  id: string
  round: number
  deltaHash: string
  ttl: number
  origin: string
  payloadRef: string // S3/R2 key in production
}

export interface GossipPeer {
  nodeId: string
  lastSeen: number
  fanout: number
}

const seen = new Set<string>()

export function resetGossipState(): void {
  seen.clear()
}

export function shouldPropagate(msg: GossipMessage): boolean {
  if (seen.has(msg.id)) return false
  if (msg.ttl <= 0) return false
  seen.add(msg.id)
  return true
}

export function fanoutPeers(peers: GossipPeer[], k: number): GossipPeer[] {
  return [...peers].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, k)
}

export function decayTtl(msg: GossipMessage): GossipMessage {
  return { ...msg, ttl: msg.ttl - 1 }
}

export function epidemicCoverage(n: number, fanout: number, rounds: number): number {
  // approximate: 1 - (1 - fanout/n)^rounds * n ... simplified upper bound
  const p = 1 - Math.pow(1 - fanout / Math.max(n, 1), rounds)
  return Math.min(1, p * n / Math.max(n, 1))
}
