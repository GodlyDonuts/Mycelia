"use client"

import { useState } from "react"
import { AppShell } from "@/components/dashboard/app-shell"

type Endpoint = {
  label: string
  method: "GET" | "POST"
  path: string
  payload?: unknown
}

const ENDPOINTS: Endpoint[] = [
  {
    label: "Health",
    method: "GET",
    path: "/api/health",
  },
  {
    label: "Submit",
    method: "POST",
    path: "/api/submit",
    payload: { jobName: "demo fractal render", tiles: 64 },
  },
  {
    label: "Pull Work",
    method: "POST",
    path: "/api/pull-work",
    payload: { nodeId: "browser-node-demo", capabilityClass: "cpu_only" },
  },
  {
    label: "Submit Result",
    method: "POST",
    path: "/api/submit-result",
    payload: { tileId: "tile-demo-001", resultHash: "stub-hash" },
  },
  {
    label: "Settle",
    method: "POST",
    path: "/api/settle",
    payload: { jobId: "job-demo-001" },
  },
  {
    label: "Parse Job",
    method: "POST",
    path: "/api/jobs/parse",
    payload: { prompt: "render a 4K deep zoom under two minutes" },
  },
]

async function callEndpoint(endpoint: Endpoint) {
  const response = await fetch(endpoint.path, {
    method: endpoint.method,
    headers: endpoint.method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: endpoint.method === "POST" ? JSON.stringify(endpoint.payload) : undefined,
  })

  return response.json()
}

export default function BackendSmokePage() {
  const [selected, setSelected] = useState(ENDPOINTS[0])
  const [result, setResult] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (endpoint: Endpoint) => {
    setSelected(endpoint)
    setLoading(true)
    setError(null)

    try {
      const json = await callEndpoint(endpoint)
      setResult(json)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell active="Settings" title="Backend Smoke Test" subtitle="api stubs · dev">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground">Backend smoke test</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Temporary page for proving frontend-to-backend communication. These endpoints only echo payloads; no
            database, scheduler, ledger, or worker logic is wired yet.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Endpoints</h2>
            <div className="mt-4 flex flex-col gap-2">
              {ENDPOINTS.map((endpoint) => (
                <button
                  key={endpoint.path}
                  type="button"
                  onClick={() => run(endpoint)}
                  disabled={loading}
                  className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
                >
                  <span>{endpoint.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{endpoint.method}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary">
                {selected.method}
              </span>
              <span className="font-mono text-sm text-foreground">{selected.path}</span>
              {loading && <span className="ml-auto font-mono text-xs text-muted-foreground">requesting...</span>}
            </div>

            {selected.payload !== undefined && (
              <div className="mt-4">
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-tertiary">Sample payload</h3>
                <pre className="overflow-auto rounded-xl border border-border bg-background/70 p-3 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>
            )}

            <div className="mt-4">
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-tertiary">Response</h3>
              <pre className="min-h-60 overflow-auto rounded-xl border border-border bg-background/70 p-3 font-mono text-xs text-foreground">
                {error ? error : result ? JSON.stringify(result, null, 2) : "Click an endpoint to send a request."}
              </pre>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
