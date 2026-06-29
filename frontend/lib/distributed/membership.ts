// Cell membership & failure detection (SWIM-style gossip + coordinator authority).
// Tracks which nodes form each training cell and handles straggler ejection.

export type NodeHealth = "healthy" | "suspect" | "dead" | "draining"

export interface CellMember {
  nodeId: string
  cellId: string
  stageIndex: number
  health: NodeHealth
  lastHeartbeat: number
  capabilityScore: number
}

const members = new Map<string, CellMember>()

export function resetMembership(): void {
  members.clear()
}

export function registerMember(m: CellMember): void {
  members.set(m.nodeId, { ...m })
}

export function heartbeat(nodeId: string): boolean {
  const m = members.get(nodeId)
  if (!m) return false
  m.lastHeartbeat = Date.now()
  if (m.health === "suspect") m.health = "healthy"
  return true
}

export function detectFailures(now: number, timeoutMs: number): string[] {
  const failed: string[] = []
  for (const [id, m] of members) {
    if (now - m.lastHeartbeat > timeoutMs) {
      m.health = m.health === "suspect" ? "dead" : "suspect"
      if (m.health === "dead") failed.push(id)
    }
  }
  return failed
}

export function cellQuorum(cellId: string): { total: number; healthy: number; hasQuorum: boolean } {
  const cell = [...members.values()].filter((m) => m.cellId === cellId)
  const healthy = cell.filter((m) => m.health === "healthy").length
  const total = cell.length
  return { total, healthy, hasQuorum: healthy >= Math.ceil(total / 2) }
}

export function ejectStragglers(cellId: string, p95LatencyMs: number, threshold: number): string[] {
  return [...members.values()]
    .filter((m) => m.cellId === cellId && p95LatencyMs * 2 > threshold)
    .map((m) => m.nodeId)
}
