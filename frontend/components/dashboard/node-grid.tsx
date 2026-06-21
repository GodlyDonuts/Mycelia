"use client"

import { NODES, type NodeData } from "@/lib/dashboard-data"
import { usePoll } from "@/lib/api"
import { NodeCard, NodeCardSkeleton, AddDeviceCard } from "./node-card"

type DashboardPayload = { nodes: NodeData[] }

export function NodeGrid() {
  // Live node roster + gauges from the read API. While the first frame is
  // loading (`data === null`), show skeletons; fall back to mock NODES on error.
  const { data, error } = usePoll<DashboardPayload>("/api/dashboard", 2000)
  const loading = data === null && error === null
  const nodes = data?.nodes ?? NODES

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
