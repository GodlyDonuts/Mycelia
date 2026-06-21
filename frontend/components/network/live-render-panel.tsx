"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Download } from "lucide-react"
import { base64ToBytes } from "@/lib/fractal"
import { tileImageData } from "@/lib/api"
import { cn } from "@/lib/utils"

interface RenderTile {
  index: number
  state: "done" | "computing" | "pending"
  node: string
  gpuMs: number
  px0: number
  py0: number
  b64: string | null
}
interface ActiveRender {
  jobId: string
  name: string
  width: number
  height: number
  tilePx: number
  cols: number
  total: number
  completed: number
  status: string
  tiles: RenderTile[]
}

export function LiveRenderPanel() {
  const [render, setRender] = useState<ActiveRender | null>(null)
  const [flash, setFlash] = useState<Set<number>>(new Set())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawn = useRef<Map<string, Set<number>>>(new Map())

  // Poll the live render at the 1s active beat (PLAN.md §3) and paint each
  // newly-verified tile's REAL computed pixels onto the canvas.
  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const res = await fetch("/api/render/active", { cache: "no-store" })
        const data: ActiveRender | null = await res.json()
        if (!alive || !data) return
        setRender(data)
        const canvas = canvasRef.current
        if (!canvas) return
        if (canvas.width !== data.width) {
          canvas.width = data.width
          canvas.height = data.height
        }
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        // reset the drawn-cache when the job changes
        if (!drawn.current.has(data.jobId)) {
          drawn.current = new Map([[data.jobId, new Set()]])
          ctx.fillStyle = "#0a0e0d"
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        const seen = drawn.current.get(data.jobId)!
        const fresh: number[] = []
        for (const t of data.tiles) {
          if (t.state === "done" && t.b64 && !seen.has(t.index)) {
            const bytes = base64ToBytes(t.b64)
            ctx.putImageData(tileImageData(bytes, data.tilePx), t.px0, t.py0)
            seen.add(t.index)
            fresh.push(t.index)
          }
        }
        if (fresh.length) {
          setFlash((f) => {
            const n = new Set(f)
            fresh.forEach((i) => n.add(i))
            return n
          })
          setTimeout(() => {
            setFlash((f) => {
              const n = new Set(f)
              fresh.forEach((i) => n.delete(i))
              return n
            })
          }, 650)
        }
      } catch {
        /* keep last frame */
      }
    }
    run()
    const id = setInterval(run, 1000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const done = render?.completed ?? 0
  const total = render?.total ?? 64
  const cols = render?.cols ?? 8
  const pct = total ? Math.round((done / total) * 100) : 0
  const avgGpu = useMemo(() => {
    if (!render) return 0
    const d = render.tiles.filter((t) => t.state === "done" && t.gpuMs > 0)
    if (!d.length) return 0
    return Math.round(d.reduce((s, t) => s + t.gpuMs, 0) / d.length)
  }, [render])

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Live Render</h2>
          <p className="truncate font-mono text-[11px] text-tertiary">{render?.name ?? "fractal-deepzoom"} · tiled</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const c = canvasRef.current
              if (!c) return
              const a = document.createElement("a")
              a.href = c.toDataURL("image/png")
              a.download = `mycelia-render-${(render?.jobId ?? "image").slice(0, 8)}.png`
              a.click()
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            title="Download the reassembled image as PNG"
          >
            <Download className="size-3.5" /> png
          </button>
          <span className="font-mono text-[11px] tabular-nums text-primary">{pct}%</span>
        </div>
      </div>

      {/* canvas reassembled from real computed tile pixels, with a live scaffold overlay */}
      <div className="relative mx-auto aspect-square w-full max-w-[20rem] overflow-hidden rounded-xl border border-border bg-background">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ imageRendering: "auto" }} />
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${cols}, 1fr)` }}
        >
          {render?.tiles.map((tile) => {
            const isDone = tile.state === "done"
            const isComputing = tile.state === "computing"
            return (
              <div key={tile.index} className="relative">
                {!isDone && (
                  <div className={cn("absolute inset-0 border border-border/30 bg-secondary/40 backdrop-blur-[1px]", isComputing && "bg-primary/10")} />
                )}
                {isComputing && (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-y-0 -left-full w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent [animation:shimmer_0.9s_linear_infinite]" />
                  </div>
                )}
                {flash.has(tile.index) && (
                  <div className="absolute inset-0 bg-primary/40 [animation:fade-in-up_0.3s_ease-out]" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 font-mono text-[11px]">
        <div className="flex flex-col">
          <span className="text-tertiary">tiles</span>
          <span className="tabular-nums text-foreground">{done}/{total}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-tertiary">GPU time / tile</span>
          <span className="tabular-nums text-primary">{avgGpu} ms</span>
        </div>
        <div className="flex flex-col">
          <span className="text-tertiary">resolution</span>
          <span className="tabular-nums text-foreground">{render ? `${render.width}²` : "512²"}</span>
        </div>
      </div>
    </div>
  )
}
