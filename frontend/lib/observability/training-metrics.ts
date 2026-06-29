/**
 * Training metrics collector — emits OTel-compatible counters for coordinator observability.
 * Wired into Health screen reconciliation (roadmap: Prometheus scrape).
 */

export interface TrainingMetrics {
  round: number
  activeCells: number
  avgLoss: number
  bytesShipped: number
  p2pSessions: number
  zkProofsVerified: number
}

const history: TrainingMetrics[] = []

export function recordMetrics(m: TrainingMetrics): void {
  history.push({ ...m })
  if (history.length > 1000) history.shift()
}

export function latestMetrics(): TrainingMetrics | null {
  return history[history.length - 1] ?? null
}

export function lossTrend(window = 20): number[] {
  return history.slice(-window).map((m) => m.avgLoss)
}

export function exportPrometheus(): string {
  const m = latestMetrics()
  if (!m) return "# no metrics yet\n"
  return [
    `# HELP mycelia_training_round Current training round`,
    `mycelia_training_round ${m.round}`,
    `# HELP mycelia_active_cells Active training cells`,
    `mycelia_active_cells ${m.activeCells}`,
    `# HELP mycelia_avg_loss Average validation loss`,
    `mycelia_avg_loss ${m.avgLoss}`,
    `# HELP mycelia_bytes_shipped Total adapter bytes shipped`,
    `mycelia_bytes_shipped ${m.bytesShipped}`,
    `# HELP mycelia_p2p_sessions Active WebRTC sessions`,
    `mycelia_p2p_sessions ${m.p2pSessions}`,
  ].join("\n") + "\n"
}
