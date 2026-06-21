"use client"

import { useState, useRef } from "react"
import { Sparkles, ArrowUp, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { EXAMPLE_PROMPTS, parseJobFromPrompt, type JobFormState } from "@/lib/marketplace-data"
import { parseJob } from "@/lib/api-client"
import type { ParseJobRequest } from "@/lib/api-contracts"

/**
 * The magical centerpiece: a natural-language job intake.
 *
 * On submit we currently MOCK the round-trip. In production `onParsed` is fed
 * by a call to the Claude structured-output endpoint:
 *
   *   const res = await fetch("/jobs/parse", {
 *     method: "POST",
 *     body: JSON.stringify({ prompt }),
 *   })
 *   const spec: JobFormState = await res.json()  // validated against a JSON schema
 *
 * The streaming "thinking" shimmer below mirrors the tokens streaming back from
 * the model before the structured spec resolves.
 */
export function NlIntake({ onParsed }: { onParsed: (spec: JobFormState) => void }) {
  const [prompt, setPrompt] = useState("")
  const [thinking, setThinking] = useState(false)
  const [stage, setStage] = useState<string>("")
  const [backendStatus, setBackendStatus] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const run = async (text: string) => {
    if (!text.trim() || thinking) return
    setThinking(true)
    setBackendStatus(null)

    // Simulated streaming stages — replace with real token/stream events.
    const stages = ["Reading your request…", "Inferring GPU tier & resources…", "Drafting a validated job spec…"]
    let i = 0
    setStage(stages[0])
    const tick = setInterval(() => {
      i += 1
      if (i < stages.length) setStage(stages[i])
    }, 520)

    try {
      const body: ParseJobRequest = { prompt: text }
      const resultPromise = parseJob(body)
      await new Promise((resolve) => setTimeout(resolve, 1700))
      const result = await resultPromise

      if (!result.response.ok) {
        throw new Error(result.response.error)
      }

      setBackendStatus("/jobs/parse reached; using local mock spec until Claude is wired")
    } catch {
      setBackendStatus("Parse API unavailable; using local mock fallback")
    } finally {
      clearInterval(tick)
      const spec = parseJobFromPrompt(text)
      onParsed(spec)
      setThinking(false)
      setStage("")
    }
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-5 transition-shadow",
        thinking ? "border-primary/40 [animation:node-glow_2.2s_ease-in-out_infinite]" : "border-primary/25 glow-teal",
      )}
    >
      {/* ambient spore glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="size-4 [animation:spore-pulse_3s_ease-in-out_infinite]" strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Describe your job in plain English</h2>
            <p className="font-mono text-[11px] text-tertiary">we&apos;ll shape it into a runnable spec</p>
          </div>
        </div>

        {/* input */}
        <div className="relative mt-4">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(prompt)
            }}
            rows={3}
            disabled={thinking}
            placeholder="Describe your job in plain English…  e.g. “Fine-tune a LoRA on this dataset under $5”"
            aria-label="Describe your job in plain English"
            className="w-full resize-none rounded-xl border border-input bg-background/60 p-3.5 pr-12 text-sm leading-relaxed text-foreground placeholder:text-tertiary outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/30 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => run(prompt)}
            disabled={!prompt.trim() || thinking}
            aria-label="Generate job spec"
            className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* example chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={thinking}
              onClick={() => {
                setPrompt(ex)
                run(ex)
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:opacity-50"
            >
              <Wand2 className="size-3 text-primary/70" />
              {ex}
            </button>
          ))}
        </div>

        {/* thinking shimmer */}
        {thinking && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 [animation:fade-in-up_0.3s_ease-out]">
            <span className="relative flex size-4 shrink-0 items-center justify-center">
              <span className="absolute size-4 rounded-full bg-primary/30 [animation:spore-pulse_1.2s_ease-in-out_infinite]" />
              <span className="size-2 rounded-full bg-primary" />
            </span>
            <span className="font-mono text-xs text-foreground">{stage}</span>
            {/* shimmering token bars */}
            <span className="ml-auto flex items-center gap-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-6 overflow-hidden rounded-full bg-secondary"
                >
                  <span
                    className="block h-full w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent"
                    style={{ animation: `shimmer 1.1s ease-in-out ${i * 0.18}s infinite` }}
                  />
                </span>
              ))}
            </span>
          </div>
        )}

        {!thinking && backendStatus && (
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-tertiary [animation:fade-in-up_0.3s_ease-out]">
            {backendStatus}
          </p>
        )}
      </div>
    </div>
  )
}
