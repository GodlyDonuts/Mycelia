import { describe, it, expect } from "vitest"
import { withTx } from "@/lib/db"

// 40001 retry-correctness (#79). On Aurora DSQL, optimistic-concurrency conflicts
// surface as SQLSTATE 40001 and MUST be retried by the caller; PGlite stands in
// locally. These tests pin the retry CONTRACT of withTx so the swap to DSQL keeps
// the same semantics: retry only on 40001, surface everything else immediately,
// and give up after a bounded number of attempts.

class PgError extends Error {
  code: string
  constructor(code: string) {
    super(`pg ${code}`)
    this.code = code
  }
}

describe("withTx 40001 retry contract", () => {
  it("retries a 40001 conflict and then commits", async () => {
    let attempts = 0
    const out = await withTx(async () => {
      attempts++
      if (attempts < 3) throw new PgError("40001") // conflict twice, then succeed
      return "ok"
    })
    expect(out).toBe("ok")
    expect(attempts).toBe(3)
  })

  it("does NOT retry a non-40001 error (surfaces immediately)", async () => {
    let attempts = 0
    await expect(
      withTx(async () => {
        attempts++
        throw new PgError("23505") // unique-violation — a real bug, not a conflict
      }),
    ).rejects.toMatchObject({ code: "23505" })
    expect(attempts).toBe(1)
  })

  it("gives up after a bounded number of retries on persistent conflict", async () => {
    let attempts = 0
    await expect(
      withTx(async () => {
        attempts++
        throw new PgError("40001")
      }),
    ).rejects.toMatchObject({ code: "40001" })
    expect(attempts).toBeGreaterThan(1)
    expect(attempts).toBeLessThanOrEqual(5) // MAX
  })
})
