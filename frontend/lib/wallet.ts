// MYC redemption / wallet (PLAN §7). MYC launches as an internal stable-value
// credit, redeemable to cash / gift-card / crypto later (Salad-style on-ramp).
// Redemption is a ledger 'redeem' debit against the contributor's derived
// balance — deliberately gated behind a tax/KYC/AML disclosure.

import { query, queryOne, num, withTx } from "./db"
import { DEMO_USER, mycToUsd } from "./myc"

export const REDEEM_METHODS = ["bank", "giftcard", "crypto"] as const
export type RedeemMethod = (typeof REDEEM_METHODS)[number]

export async function getWallet(accountId = DEMO_USER) {
  const bal = await queryOne<{ s: string }>(
    `SELECT coalesce(sum(amount_myc),0)::float8 AS s FROM ledger_entries WHERE account_id=$1`, [accountId])
  const earned = await queryOne<{ s: string }>(
    `SELECT coalesce(sum(amount_myc),0)::float8 AS s FROM ledger_entries WHERE account_id=$1 AND entry_type='provider_earn'`, [accountId])
  const redeemed = await queryOne<{ s: string }>(
    `SELECT coalesce(sum(amount_myc),0)::float8 AS s FROM ledger_entries WHERE account_id=$1 AND entry_type='redeem'`, [accountId])
  const history = await query<{ amount_myc: string; memo: string | null; created_at: string }>(
    `SELECT amount_myc::float8 AS amount_myc, memo, created_at FROM ledger_entries
     WHERE account_id=$1 AND entry_type='redeem' ORDER BY created_at DESC LIMIT 12`, [accountId])
  const balance = Math.round(num(bal?.s))
  return {
    balance,
    balanceUsd: mycToUsd(balance),
    totalEarned: Math.round(num(earned?.s)),
    totalRedeemed: Math.abs(Math.round(num(redeemed?.s))),
    history: history.map((h) => ({
      amount: Math.abs(Math.round(num(h.amount_myc))),
      usd: mycToUsd(Math.abs(num(h.amount_myc))),
      memo: h.memo,
      ts: new Date(h.created_at).getTime(),
    })),
  }
}

export async function requestRedemption(amountMyc: number, method: RedeemMethod, accountId = DEMO_USER) {
  if (!(amountMyc > 0)) throw new Error("INVALID_AMOUNT")
  return withTx(async (tx) => {
    const bal = await tx.queryOne<{ s: string }>(
      `SELECT coalesce(sum(amount_myc),0)::float8 AS s FROM ledger_entries WHERE account_id=$1`, [accountId])
    if (num(bal?.s) < amountMyc) throw new Error("INSUFFICIENT_BALANCE")
    await tx.query(
      `INSERT INTO ledger_entries(account_id,amount_myc,entry_type,idempotency_key,memo)
       VALUES ($1,$2,'redeem',$3,$4)`,
      [accountId, -amountMyc, `redeem-${accountId}-${Date.now()}`, `cash-out via ${method}`],
    )
    return { redeemed: amountMyc, usd: mycToUsd(amountMyc), method }
  })
}
