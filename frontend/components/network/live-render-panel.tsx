"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { RENDER_TILES, TILE_GRID, type RenderTile } from "@/lib/network-data"
import { cn } from "@/lib/utils"

export function LiveRenderPanel() {
  const [tiles, setTiles] = useState<RenderTile[]>(RENDER_TILES)
  // tiles that just landed get a brief shimmer flash
  const [flash, setFlash] = useState<Set<number>>(new Set())
  const computingRef = useRef<number | null>(null)

  // SSE: the render coordinator pushes `{tile, state, gpuMs}` as each tile is
  // verified. Here we walk pending -> computing -> done on an interval and
  // restart once the image fully resolves, so the assembly loops forever.
  useEffect(() => {
    const id = setInterval(() => {
      setTiles((prev) => {
        const next = [...prev]
        // clear a tile that was computing -> mark done + flash
        if (computingRef.current != null) {
          const c = computingRef.current
          next[c] = { ...next[c], state: "done" }
          setFlash((f) => new Set(f).add(c))
          setTimeout(() => {
            setFlash((f) => {
              const n = new Set(f)
              n.delete(c)
              return n
            })
          }, 650)
          computingRef.current = null
        }
        const pending = next.findIndex((t) => t.state === "pending")
        if (pending === -1) {
          // fully resolved — reset to a fresh partial render
          return prev.map((t, i) => ({
            ...t,
            state: (i * 7) % 5 === 0 || (i * 13) % 7 === 0 ? "done" : "pending",
          }))
        }
        next[pending] = { ...next[pending], state: "computing" }
        computingRef.current = pending
        return next
      })
    }, 420)
    return () => clearInterval(id)
  }, [])

  const done = useMemo(() => tiles.filter((t) => t.state === "done").length, [tiles])
  const total = tiles.length
  const pct = Math.round((done / total) * 100)
  // rolling average GPU time across already-rendered tiles
  const avgGpu = useMemo(() => {
    const d = tiles.filter((t) => t.state === "done")
    if (!d.length) return 0
    return Math.round(d.reduce((s, t) => s + t.gpuMs, 0) / d.length)
  }, [tiles])

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Live Render</h2>
          <p className="font-mono text-[11px] text-tertiary">fractal-deepzoom · tiled</p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-primary">{pct}%</span>
      </div>

      {/* tile canvas — the fractal image revealed tile-by-tile */}
      <div className="relative mx-auto aspect-square w-full max-w-[20rem] overflow-hidden rounded-xl border border-border bg-background">
        <div
          className="grid h-full w-full"
          style={{ gridTemplateColumns: `repeat(${TILE_GRID}, 1fr)`, gridTemplateRows: `repeat(${TILE_GRID}, 1fr)` }}
        >
          {tiles.map((tile) => {
            const col = tile.id % TILE_GRID
            const row = Math.floor(tile.id / TILE_GRID)
            const bgX = (col / (TILE_GRID - 1)) * 100
            const bgY = (row / (TILE_GRID - 1)) * 100
            const isDone = tile.state === "done"
            const isComputing = tile.state === "computing"
            return (
              <div key={tile.id} className="relative">
                {/* the actual image slice for this tile, revealed when done */}
                <div
                  className="absolute inset-0 transition-opacity duration-500"
                  style={{
                    backgroundImage: "url(/fractal-deepzoom.png)",
                    backgroundSize: `${TILE_GRID * 100}% ${TILE_GRID * 100}%`,
                    backgroundPosition: `${bgX}% ${bgY}%`,
                    opacity: isDone ? 1 : 0,
                  }}
                />
                {/* pending scaffold */}
                {!isDone && (
                  <div className={cn("absolute inset-0 border border-border/40 bg-secondary/30", isComputing && "bg-primary/10")} />
                )}
                {/* computing shimmer sweep */}
                {isComputing && (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-y-0 -left-full w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent [animation:shimmer_0.9s_linear_infinite]" />
                  </div>
                )}
                {/* brief flash as a freshly-verified tile lands */}
                {flash.has(tile.id) && (
                  <div className="absolute inset-0 bg-primary/30 [animation:fade-in-up_0.3s_ease-out]" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* mono readouts */}
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
          <span className="tabular-nums text-foreground">4096²</span>
        </div>
      </div>
    </div>
  )
}
