// The verification & economics layer (PLAN §7–8) — the moat.
//
// Two claims kept SEPARATE (PLAN §8 internal note):
//   (1) Ledger — provably safe against overdraft + replay (earned, see lib/db).
//   (2) Verification — a stake-weighted spot-check that makes cheating
//       negative-EV for rational actors, with reputation driving the sampling
//       rate. For the deterministic fractal kernel a full self-check is the hard
//       guarantee; this layer models the untrusted-node economics: reputation →
//       spot-check rate → effective replication → SELLABLE FRACTION, which is the
//       dominant term in the unit economics.

import { query, queryOne, num } from "./db"

/** Stake-weighted spot-check rate: proven nodes ~5% sampled, unproven ~100%. */
export function spotCheckRate(reputation: number): number {
  const r = Math.max(0, Math.min(100, reputation))
  return Math.max(0.05, Math.min(1, 0.05 + (1 - r / 100) * 0.95))
}

/** Effective replication tax: ~1.05x for proven nodes, ~2.0x for unproven. */
export function effReplication(reputation: number): number {
  const r = Math.max(0, Math.min(100, reputation))
  return 1.05 + (1 - r / 100) * 0.95
}

export function sellableFraction(reputation: number): number {
  return 1 / effReplication(reputation)
}

// ---- unit economics (PLAN §7 worked example, computed live) ----------------

const INCR_KWH = 0.2 // +200W incremental at load → 0.20 kWh / node-hour
const REQ_PRICE = 0.15 // requester $/sellable GPU-hour (undercuts hyperscaler)
const PLATFORM_FEE = 0.2

export function unitEconomics(kwhPrice: number, sellable: number) {
  const electricity = INCR_KWH * kwhPrice
  const gross = REQ_PRICE * sellable
  const fee = gross * PLATFORM_FEE
  const receives = gross - fee
  const net = receives - electricity
  return {
    electricity: round(electricity),
    gross: round(gross),
    fee: round(fee),
    receives: round(receives),
    net: round(net),
  }
}
const round = (x: number) => Math.round(x * 1000) / 1000

// ---- live network verification snapshot -----------------------------------

export async function getVerification() {
  const nodes = await query<{ reputation: string; stake_myc: string; status: string }>(
    `SELECT reputation, stake_myc, status FROM nodes`,
  )
  const online = nodes.filter((n) => n.status !== "offline")
  const avgRep = online.length ? online.reduce((s, n) => s + num(n.reputation), 0) / online.length : 50
  const netSellable =
    online.length ? online.reduce((s, n) => s + sellableFraction(num(n.reputation)), 0) / online.length : 0.7
  const totalStake = nodes.reduce((s, n) => s + num(n.stake_myc), 0)

  const slashed = await queryOne<{ s: string }>(
    `SELECT coalesce(sum(amount_myc),0)::float8 AS s FROM ledger_entries WHERE entry_type='slash'`,
  )
  const challenges = await queryOne<{ checks: number; failed: number }>(
    `SELECT coalesce(sum(spot_checks),0)::int AS checks, coalesce(sum(challenges_failed),0)::int AS failed FROM nodes`,
  )

  // reputation leaderboard + the cheats (lowest reputation / most failures)
  const top = await query<{ display_name: string; reputation: string; stake_myc: string; spot_checks: number; challenges_failed: number }>(
    `SELECT display_name, reputation, stake_myc, spot_checks, challenges_failed FROM nodes WHERE status<>'offline'
     ORDER BY reputation DESC, stake_myc DESC LIMIT 6`,
  )
  const flagged = await query<{ display_name: string; reputation: string; stake_myc: string; spot_checks: number; challenges_failed: number }>(
    `SELECT display_name, reputation, stake_myc, spot_checks, challenges_failed FROM nodes
     WHERE challenges_failed > 0 ORDER BY challenges_failed DESC, reputation ASC LIMIT 6`,
  )

  const mapNode = (n: { display_name: string; reputation: string; stake_myc: string; spot_checks: number; challenges_failed: number }) => ({
    name: n.display_name,
    reputation: Math.round(num(n.reputation)),
    stake: Math.round(num(n.stake_myc)),
    spotCheckRate: Math.round(spotCheckRate(num(n.reputation)) * 100),
    failed: n.challenges_failed,
    checks: n.spot_checks,
  })

  return {
    sellableFraction: Math.round(netSellable * 1000) / 10, // %
    verificationTax: Math.round((1 - netSellable) * 1000) / 10, // %
    avgReputation: Math.round(avgRep),
    totalStake: Math.round(totalStake),
    totalSlashed: Math.abs(Math.round(num(slashed?.s))),
    cheatsCaught: challenges?.failed ?? 0,
    spotChecks: challenges?.checks ?? 0,
    leaderboard: top.map(mapNode),
    flagged: flagged.map(mapNode),
    // the §7 worked example, computed against proven/unproven/live sellable fractions
    economics: {
      regimes: [
        { label: "Proven node (90% sellable)", sellable: 0.9 },
        { label: "Unproven node (50% sellable)", sellable: 0.5 },
        { label: "This network (live)", sellable: netSellable },
      ].flatMap((reg) => [
        { ...reg, kwh: 0.12, kwhLabel: "$0.12/kWh", ...unitEconomics(0.12, reg.sellable) },
        { ...reg, kwh: 0.3, kwhLabel: "$0.30/kWh", ...unitEconomics(0.3, reg.sellable) },
      ]),
    },
  }
}
