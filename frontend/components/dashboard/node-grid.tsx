"use client"

import { useEffect, useState } from "react"
import { NODES } from "@/lib/dashboard-data"
import { useNodeTelemetry } from "@/hooks/use-node-telemetry"
import { NodeCard, NodeCardSkeleton, AddDeviceCard } from "./node-card"

export function NodeGrid() {
  // Simulated initial fetch -> shows skeletons. Replace with real load state
  // (SWR `isLoading`) once the node roster endpoint is wired in.
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1100)
    return () => clearTimeout(t)
  }, [])

  // live gauges stream in here once loaded
  const nodes = useNodeTelemetry(NODES)

  return (
    <section aria-label="Your devices">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">
          Your devices
          <span className="ml-2 font-mono text-xs text-tertiary">
            {loading ? "—" : `${nodes.filter((n) => n.status !== "offline").length}/${nodes.length} active`}
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <NodeCardSkeleton key={i} />)
        ) : (
          <>
            {nodes.map((node) => (
              <NodeCard key={node.id} node={node} />
            ))}
            <AddDeviceCard />
          </>
        )}
      </div>
    </section>
  )
}
