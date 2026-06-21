"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Cpu, Zap, Loader2, Power } from "lucide-react"
import { createComputer, type Computer } from "@/lib/compute-client"
import { cn } from "@/lib/utils"

type Status = "idle" | "joining" | "working" | "waiting"

export function JoinMesh() {
  const [status, setStatus] = useState<Status>("idle")
  const [mode, setMode] = useState<"webgpu" | "cpu" | null>(null)
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [tiles, setTiles] = useState(0)
  const [earned, setEarned] = useState(0)
  const [lastMs, setLastMs] = useState<number | null>(null)

  const running = useRef(false)
  const computer = useRef<Computer | null>(null)
  const node = useRef<{ id: string; name: string } | null>(null)

  const loop = useCallback(async () => {
    if (!running.current || !node.current || !computer.current) return
    try {
      const res = await fetch("/api/pull-work", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nodeId: node.current.id, nodeName: node.current.name }),
      })
      const { tile } = await res.json()
      if (tile) {
        setStatus("working")
        const { b64, gpuMs } = await computer.current.compute(tile.params, tile.tileIndex)
        const out = await fetch("/api/submit-result", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tileId: tile.tileId, nodeId: node.current.id, nodeName: node.current.name, resultB64: b64, gpuMs }),
        }).then((r) => r.json())
        setLastMs(gpuMs)
        if (out.verified) {
          setTiles((t) => t + 1)
          setEarned((e) => Math.round((e + (out.reward || 0)) * 100) / 100)
        }
        if (running.current) setTimeout(loop, 120)
      } else {
        setStatus("waiting")
        if (running.current) setTimeout(loop, 1400)
      }
    } catch {
      if (running.current) setTimeout(loop, 1500)
    }
  }, [])

  const join = useCallback(async () => {
    setStatus("joining")
    const comp = await createComputer(true)
    computer.current = comp
    setMode(comp.mode)
    const name = comp.mode === "webgpu" ? "this-browser·gpu" : "this-browser·cpu"
    const reg = await fetch("/api/nodes/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, kind: comp.mode === "webgpu" ? "gpu" : "browser", gpuModel: comp.mode === "webgpu" ? "WebGPU" : "—" }),
    }).then((r) => r.json())
    node.current = { id: reg.id, name }
    setNodeId(reg.id)
    running.current = true
    setStatus("working")
    loop()
  }, [loop])

  const leave = useCallback(() => {
    running.current = false
    computer.current?.dispose()
    computer.current = null
    setStatus("idle")
    setMode(null)
  }, [])

  useEffect(() => () => { running.current = false; computer.current?.dispose() }, [])

  const joined = status !== "idle"

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", joined ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
          {mode === "webgpu" ? <Zap className="size-5" /> : <Cpu className="size-5" />}
        </span>
        <div>
          <h2 className="text-sm font-medium text-foreground">
            {joined ? "You are part of the mesh" : "Join the mesh"}
          </h2>
          <p className="max-w-md text-pretty text-[12px] text-muted-foreground">
            {joined
              ? `Computing real deep-zoom fractal tiles in your browser via ${mode === "webgpu" ? "a WGSL WebGPU compute shader" : "a CPU Web Worker"} — verified and paid through the live ledger.`
              : "Zero install. Contribute idle compute right from this tab and earn MYC for every verified tile."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {joined && (
          <div className="grid grid-cols-3 gap-4 font-mono text-[11px]">
            <div className="flex flex-col">
              <span className="text-tertiary">mode</span>
              <span className={cn("tabular-nums", mode === "webgpu" ? "text-accent" : "text-primary")}>{mode === "webgpu" ? "WebGPU" : "CPU"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-tertiary">tiles</span>
              <span className="tabular-nums text-foreground">{tiles}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-tertiary">{mode === "webgpu" ? "GPU / tile" : "CPU / tile"}</span>
              <span className="tabular-nums text-primary">{lastMs != null ? `${lastMs} ms` : "—"}</span>
            </div>
            <div className="col-span-3 flex items-center gap-1.5 text-accent">
              <span className="text-tertiary">earned</span>
              <span className="tabular-nums">+{earned} MYC</span>
            </div>
          </div>
        )}

        {!joined ? (
          <button
            onClick={join}
            disabled={status === "joining"}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {status === "joining" ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {status === "joining" ? "Connecting…" : "Join the mesh"}
          </button>
        ) : (
          <button
            onClick={leave}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <Power className="size-4" /> Leave
          </button>
        )}
      </div>
    </div>
  )
}
