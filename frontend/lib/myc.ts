// MYC credit economy constants + helpers (PLAN.md §7).
// MYC is an internal stable-value credit; redemption is deliberately out of MVP.

export const MYC_USD = 0.12 // 1 MYC ≈ $0.12 (matches the dashboard/marketplace UI)
export const PLATFORM_FEE = 0.2 // 20% of requester spend (PLAN.md §7)

/** Fixed internal account ids for the demo (pre-funded — no real-money overdraft). */
export const PLATFORM_ACCOUNT = "00000000-0000-0000-0000-0000000000fe"
export const DEMO_REQUESTER = "00000000-0000-0000-0000-0000000000a1"
export const DEMO_USER = "00000000-0000-0000-0000-0000000000b1" // "you" — owns the visible contributor nodes

export function mycToUsd(myc: number): number {
  return Math.round(myc * MYC_USD * 100) / 100
}

/**
 * Split a per-tile reward into provider earnings and platform fee. The provider
 * takes the exact remainder (perTile − fee) so provider + fee === perTile with no
 * rounding drift — escrow always exactly covers payouts (verified by the
 * reconciliation sweep).
 */
export function splitReward(perTile: number): { provider: number; fee: number } {
  const fee = Math.round(perTile * PLATFORM_FEE * 1000) / 1000
  return { provider: perTile - fee, fee }
}
