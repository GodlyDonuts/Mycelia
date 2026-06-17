"use client"

import { useEffect, useState } from "react"
import type { NodeData } from "@/lib/dashboard-data"

/**
 * useNodeTelemetry
 * ----------------
 * LIVE TELEMETRY ENTRY POINT.
 *
 * Today this simulates per-node heartbeats by jittering cpu/gpu/ram and
 * advancing job progress on an interval. In production, replace the interval
 * body with a subscription to the node heartbeat stream, e.g.:
 *
 *   const socket = new WebSocket(`wss://mesh.mycelia.net/nodes/telemetry`)
 *   socket.onmessage = (e) => {
 *     const { nodeId, cpu, gpu, ram, job } = JSON.parse(e.data)
 *     setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, cpu, gpu, ram, job } : n)))
 *   }
 *
 * The component contract (NodeData) stays identical, so the UI needs no changes.
 */
export function useNodeTelemetry(initial: NodeData[]) {
  const [nodes, setNodes] = useState<NodeData[]>(initial)

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const clamp = (n: number) => Math.max(0, Math.min(100, n))

    const id = setInterval(
      () => {
        setNodes((prev) =>
          prev.map((n) => {
            if (n.status === "offline") return n
            const active = n.status === "online" && n.job
            // idle nodes barely move; active nodes wobble around their load
            const amp = active ? 9 : 3
            const cpu = clamp(n.cpu + (Math.random() - 0.5) * amp)
            const gpu = clamp(n.gpu + (Math.random() - 0.5) * amp)
            const ram = clamp(n.ram + (Math.random() - 0.5) * (amp / 2))
            const job =
              n.job != null
                ? { ...n.job, progress: clamp(n.job.progress + (active ? Math.random() * 0.8 : 0)) }
                : null
            return { ...n, cpu, gpu, ram, job }
          }),
        )
      },
      reduced ? 4000 : 1500,
    )
    return () => clearInterval(id)
  }, [])

  return nodes
}
