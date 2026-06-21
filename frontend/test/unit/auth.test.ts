import { describe, it, expect } from "vitest"
import { createSession, verifySession, canSubmit, accountForRole } from "@/lib/auth"
import { DEMO_REQUESTER, DEMO_USER } from "@/lib/myc"

describe("auth sessions", () => {
  it("round-trips a signed session", () => {
    const s = { id: DEMO_USER, name: "ada", role: "provider" as const, ts: 123 }
    const v = verifySession(createSession(s))
    expect(v).toEqual(s)
  })

  it("rejects a tampered or malformed token", () => {
    const tok = createSession({ id: DEMO_USER, name: "ada", role: "provider", ts: 1 })
    const [data] = tok.split(".")
    expect(verifySession(`${data}.deadbeef`)).toBeNull() // bad signature
    expect(verifySession("garbage")).toBeNull()
    expect(verifySession(undefined)).toBeNull()
    expect(verifySession("")).toBeNull()
  })

  it("rejects a payload swapped under a stale signature", () => {
    const tok = createSession({ id: DEMO_USER, name: "ada", role: "provider", ts: 1 })
    const sig = tok.split(".")[1]
    const forged = Buffer.from(JSON.stringify({ id: DEMO_REQUESTER, name: "evil", role: "both", ts: 1 })).toString("base64url")
    expect(verifySession(`${forged}.${sig}`)).toBeNull()
  })

  it("gates submit by role and maps roles to accounts", () => {
    expect(canSubmit("requester")).toBe(true)
    expect(canSubmit("both")).toBe(true)
    expect(canSubmit("provider")).toBe(false)
    expect(accountForRole("requester")).toBe(DEMO_REQUESTER)
    expect(accountForRole("provider")).toBe(DEMO_USER)
  })
})
