import { NextResponse } from "next/server"
import { JobSpecSchema } from "@/lib/jobspec"
import { parseJobFromPrompt } from "@/lib/marketplace-data"
import { NlParseBody } from "@/lib/contracts"
import { rateLimit, clientId, tooMany, badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// NL → schema-valid job (PLAN.md §6). Uses Claude Opus 4.8 structured output
// when ANTHROPIC_API_KEY is set; otherwise a deterministic keyword fallback.
// EITHER way the result is re-validated against the same Zod schema that guards
// /submit, so the model can shape a job but never corrupt the ledger.

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "short job name" },
    type: { type: "string", enum: ["render", "inference", "sim", "lora"] },
    image: { type: "string", description: "container image, may be empty" },
    datasetUrl: { type: "string", description: "dataset URL, may be empty" },
    gpuTier: { type: "string", enum: ["none", "T4", "A10G", "4090", "A100", "H100"] },
    vram: { type: "number" },
    ram: { type: "number" },
    maxRuntimeMin: { type: "number" },
    replication: { type: "integer", minimum: 1, maximum: 8 },
    rewardBid: { type: "number", description: "MYC reward; ~8.3 MYC per USD if a budget is mentioned" },
  },
  required: ["name", "type", "gpuTier", "vram", "ram", "maxRuntimeMin", "replication", "rewardBid"],
  additionalProperties: false,
}

async function viaClaude(prompt: string): Promise<unknown | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
        max_tokens: 1024,
        system:
          "You convert one plain-English request into a single compute job for the Mycelia marketplace. " +
          "Infer a sensible GPU tier, VRAM/RAM, runtime and a fair MYC reward bid. If the user mentions a dollar budget, " +
          "set rewardBid to roughly budget*8.3 MYC. Always call the tool.",
        tools: [{ name: "create_job", description: "Create a schema-valid Mycelia job", input_schema: TOOL_SCHEMA }],
        tool_choice: { type: "tool", name: "create_job" },
        messages: [{ role: "user", content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const block = (data.content as Array<{ type: string; input?: unknown }>).find((c) => c.type === "tool_use")
    return block?.input ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(req: Request) {
  const rl = rateLimit(`parse:${clientId(req)}`, 15, 60_000) // 15 LLM calls / minute / IP
  if (!rl.ok) return tooMany(rl.retryAfter)
  try {
    const parsed = NlParseBody.safeParse(await req.json())
    if (!parsed.success) return badRequest("prompt required (1–2000 chars)")
    const { prompt } = parsed.data
    let source: "claude" | "fallback" = "fallback"
    let raw = await viaClaude(prompt)
    if (raw) source = "claude"
    else raw = parseJobFromPrompt(prompt)

    // Re-validate against the same schema that guards /submit.
    const result = JobSpecSchema.safeParse(raw)
    const spec = result.success ? result.data : JobSpecSchema.parse(parseJobFromPrompt(prompt))
    return NextResponse.json({ ok: true, source: result.success ? source : "fallback", spec })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "error" }, { status: 400 })
  }
}
