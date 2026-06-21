import { describe, it, expect } from "vitest"
import { adaptiveReplicas, majorityVote } from "@/lib/replication"

describe("adaptive replication + N-of-M voting", () => {
  it("replica count adapts to reputation", () => {
    expect(adaptiveReplicas(95)).toBe(1)
    expect(adaptiveReplicas(60)).toBe(2)
    expect(adaptiveReplicas(10)).toBe(3)
  })

  it("majority vote picks the honest hash and flags the dissenter", () => {
    const v = majorityVote([
      { nodeId: "a", nodeName: "a", hash: "abc" },
      { nodeId: "b", nodeName: "b", hash: "abc" },
      { nodeId: "c", nodeName: "cheat", hash: "xxx" },
    ])
    expect(v.winner).toBe("abc")
    expect(v.decisive).toBe(true)
    expect(v.agreers.sort()).toEqual(["a", "b"])
    expect(v.dissenters).toEqual(["cheat"])
  })

  it("flags a non-decisive split (no strict majority)", () => {
    const v = majorityVote([
      { nodeId: "a", nodeName: "a", hash: "p" },
      { nodeId: "b", nodeName: "b", hash: "q" },
    ])
    expect(v.decisive).toBe(false)
  })

  it("unanimous agreement has no dissenters", () => {
    const v = majorityVote([
      { nodeId: "a", nodeName: "a", hash: "z" },
      { nodeId: "b", nodeName: "b", hash: "z" },
      { nodeId: "c", nodeName: "c", hash: "z" },
    ])
    expect(v.dissenters).toEqual([])
    expect(v.decisive).toBe(true)
  })
})
