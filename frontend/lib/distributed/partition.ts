// Partition tolerance & split-brain detection for coordinator failover.

export type PartitionState = "healthy" | "degraded" | "split-brain" | "isolated"

export interface RegionHeartbeat {
  region: string
  leader: boolean
  lastSeen: number
  cellCount: number
}

const heartbeats = new Map<string, RegionHeartbeat>()

export function resetPartitions(): void {
  heartbeats.clear()
}

export function recordRegion(h: RegionHeartbeat): void {
  heartbeats.set(h.region, { ...h })
}

export function detectPartition(now: number, timeoutMs: number): PartitionState {
  const leaders = [...heartbeats.values()].filter((h) => h.leader && now - h.lastSeen < timeoutMs)
  if (leaders.length === 0) return "isolated"
  if (leaders.length > 1) return "split-brain"
  const stale = [...heartbeats.values()].filter((h) => now - h.lastSeen > timeoutMs)
  return stale.length > 0 ? "degraded" : "healthy"
}

export function gossipFallbackEnabled(state: PartitionState): boolean {
  return state === "degraded" || state === "isolated"
}
