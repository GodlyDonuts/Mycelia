"use client"

// Client data layer: typed pollers that replace the v0 interval simulations
// with the real read path (PLAN.md §6 "replace v0's interval placeholders with
// real DSQL polling/SSE"). A shared poller dedupes the network feed so the four
// telemetry widgets ride one request loop instead of four.

import { useEffect, useState } from "react"

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

/** Poll a JSON endpoint on an interval; returns latest data + error. */
export function usePoll<T>(url: string, intervalMs = 2000): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const d = await getJSON<T>(url)
        if (alive) {
          setData(d)
          setError(null)
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "error")
      }
    }
    run()
    const id = setInterval(run, intervalMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [url, intervalMs])
  return { data, error }
}

// ---- shared network poller (one loop feeds many widgets) -------------------

export interface NetworkData {
  cluster: { nodesOnline: number; gpusOnline: number; tflops: number; throughput: number; jobsRunning: number; jobsQueued: number }
  utilization: number
  creditedMyc: number
  graphNodes: Array<{ id: string; label: string; kind: "gpu" | "desktop" | "laptop" | "phone"; capacity: number; load: number; gpu: string; job: string | null; x: number; y: number }>
  links: Array<{ source: string; target: string; flow: number }>
  events: Array<{ id: string; kind: string; node: string; detail: string; ts: number }>
}

let netCache: NetworkData | null = null
const netSubs = new Set<(d: NetworkData) => void>()
let netTimer: ReturnType<typeof setInterval> | null = null

function startNet() {
  if (netTimer) return
  const run = async () => {
    try {
      const d = await getJSON<NetworkData>("/api/network")
      netCache = d
      netSubs.forEach((fn) => fn(d))
    } catch {
      /* keep last good frame */
    }
  }
  run()
  netTimer = setInterval(run, 2000)
}

export function useNetwork(): NetworkData | null {
  const [data, setData] = useState<NetworkData | null>(netCache)
  useEffect(() => {
    netSubs.add(setData)
    startNet()
    if (netCache) setData(netCache)
    return () => {
      netSubs.delete(setData)
      if (netSubs.size === 0 && netTimer) {
        clearInterval(netTimer)
        netTimer = null
      }
    }
  }, [])
  return data
}

// ---- fractal palette (bioluminescent teal → amber) ------------------------

/** Map an iteration byte → RGB. 0 = interior (deep charcoal). */
export function paletteRGB(v: number): [number, number, number] {
  if (v === 0) return [10, 14, 13]
  const t = v / 255
  // smooth cyclic ramp biased toward the mycelium teal/amber palette
  const r = Math.round(40 + 215 * Math.pow(t, 1.4))
  const g = Math.round(120 + 135 * Math.sin(Math.PI * t))
  const b = Math.round(150 - 110 * t + 60 * Math.sin(Math.PI * 2 * t))
  return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))]
}

/** Build an ImageData for a single-channel tile (tilePx × tilePx bytes). */
export function tileImageData(bytes: Uint8Array, tilePx: number): ImageData {
  const img = new ImageData(tilePx, tilePx)
  for (let i = 0; i < bytes.length; i++) {
    const [r, g, b] = paletteRGB(bytes[i])
    const o = i * 4
    img.data[o] = r
    img.data[o + 1] = g
    img.data[o + 2] = b
    img.data[o + 3] = 255
  }
  return img
}
