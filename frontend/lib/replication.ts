// Adaptive replication + redundant N-of-M voting (PLAN §8). The verification
// primitive used when there's no cheap self-check: assign a unit to K nodes and
// accept the MAJORITY result; nodes that dissent from the majority are flagged
// for slashing. K adapts to reputation — proven nodes need ~1, unproven ~3 —
// which is the replication tax that drives the sellable fraction.

export interface Vote {
  nodeId: string
  nodeName: string
  hash: string
}
export interface VoteResult {
  winner: string | null
  agreers: string[] // node names that match the majority
  dissenters: string[] // node names flagged for slashing
  decisive: boolean // strict majority reached
  tally: Record<string, number>
}

/** Replicas required by reputation: proven → 1, mid → 2, unproven → 3. */
export function adaptiveReplicas(reputation: number): number {
  if (reputation >= 80) return 1
  if (reputation >= 50) return 2
  return 3
}

/** Majority-hash vote across redundant results. */
export function majorityVote(votes: Vote[]): VoteResult {
  const tally: Record<string, number> = {}
  for (const v of votes) tally[v.hash] = (tally[v.hash] ?? 0) + 1
  let winner: string | null = null
  let max = 0
  for (const [h, c] of Object.entries(tally)) if (c > max) { max = c; winner = h }
  const agreers = votes.filter((v) => v.hash === winner).map((v) => v.nodeName)
  const dissenters = votes.filter((v) => v.hash !== winner).map((v) => v.nodeName)
  return { winner, agreers, dissenters, decisive: max > votes.length / 2, tally }
}
