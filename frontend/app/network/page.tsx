import type { Metadata } from "next"
import { AppShell } from "@/components/dashboard/app-shell"
import { ClusterStatBand } from "@/components/network/cluster-stat-band"
import { JoinMesh } from "@/components/network/join-mesh"
import { MyceliumGraph } from "@/components/network/mycelium-graph"
import { LiveRenderPanel } from "@/components/network/live-render-panel"
import { TrainingPanel } from "@/components/network/training-panel"
import { UtilizationChart } from "@/components/network/utilization-chart"
import { NetworkEventLog } from "@/components/network/network-event-log"

export const metadata: Metadata = {
  title: "Network Telemetry — Mycelia",
  description:
    "Watch the Mycelia living network compute in real time: an animated mesh of nodes, tile-by-tile renders, federated training loss, and a streaming event feed.",
}

export default function NetworkPage() {
  return (
    <AppShell active="Network" title="Network Telemetry" subtitle="living mesh · live">
      <div className="mx-auto flex max-w-[110rem] flex-col gap-6">
        <div>
          <h1 className="font-display text-balance text-3xl font-normal tracking-tight text-foreground">
            The living network, in motion
          </h1>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">
            Aggregate telemetry streaming from every node in the mesh — topology, renders, training, and utilization,
            updating continuously.
          </p>
        </div>

        {/* aggregate header band */}
        <ClusterStatBand />

        {/* zero-install browser worker — real client-side fractal compute */}
        <JoinMesh />

        {/* primary row: the mesh graph (showpiece) + live render */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="min-h-[26rem] lg:min-h-[34rem]">
            <MyceliumGraph />
          </div>
          <div className="min-h-[26rem] lg:min-h-[34rem]">
            <LiveRenderPanel />
          </div>
        </div>

        {/* training + utilization */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
          <TrainingPanel />
          <UtilizationChart />
        </div>

        {/* event feed */}
        <NetworkEventLog />
      </div>
    </AppShell>
  )
}
