"use client"

// Live request-flow diagram. The teal path is what's executing right now —
// client → Vercel route handlers → app logic → the lib/db seam → the bound AWS
// database. The amber rail is the Phase-3 async fabric (SQS/EventBridge/Fargate/
// S3) that the in-process simulator stands in for. Doubles as the submission's
// architecture diagram. Reflects the live backend: if the cloud is unreachable
// the database node honestly shows the PGlite fallback.

import type { DbStatus } from "@/lib/db"

function Box({
  x,
  cx,
  title,
  sub,
  accent = "muted",
  highlight = false,
  w = 150,
  y = 88,
  h = 64,
}: {
  x?: number
  cx?: number
  title: string
  sub?: string
  accent?: "teal" | "amber" | "muted"
  highlight?: boolean
  w?: number
  y?: number
  h?: number
}) {
  const left = x ?? (cx ?? 0) - w / 2
  const stroke = accent === "teal" ? "#6fd3b8" : accent === "amber" ? "#d8a25a" : "rgba(255,255,255,0.14)"
  const fill = highlight ? "rgba(111,211,184,0.08)" : "rgba(255,255,255,0.015)"
  return (
    <g>
      <rect
        x={left}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill={fill}
        stroke={stroke}
        strokeWidth={highlight ? 1.6 : 1}
      />
      <text x={left + w / 2} y={y + (sub ? 26 : h / 2 + 4)} textAnchor="middle" fill="#ecebe4" fontSize={13} fontWeight={highlight ? 600 : 500}>
        {title}
      </text>
      {sub && (
        <text x={left + w / 2} y={y + 44} textAnchor="middle" fill="#918c81" fontSize={10.5} fontFamily="ui-monospace, monospace">
          {sub}
        </text>
      )}
    </g>
  )
}

/** A flowing dashed connector — the dash animation reads as data in motion. */
function Flow({ x1, x2, y = 120, color = "#6fd3b8", reverse = false }: { x1: number; x2: number; y?: number; color?: string; reverse?: boolean }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeOpacity={0.28} strokeWidth={1.5} />
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="6 12"
        className={reverse ? "flow-rev" : "flow"}
      />
      <polygon points={`${x2},${y} ${x2 - 7},${y - 4} ${x2 - 7},${y + 4}`} fill={color} fillOpacity={0.85} />
    </g>
  )
}

export function ArchitectureDiagram({ status }: { status: DbStatus | null }) {
  const cloud = !!status?.cloud
  const fallback = !!status?.fallback.active
  // Centers for the five-stage active pipeline.
  const cols = [91, 290, 489, 688, 887]
  const dbLabel = status?.label ?? "Aurora DSQL"
  const dbAccent: "teal" | "amber" = fallback ? "amber" : "teal"

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4">
      <svg viewBox="0 0 980 300" className="w-full min-w-[860px]" role="img" aria-label="Mycelia request-flow architecture">
        <style>{`
          .flow { animation: dashmove 1s linear infinite; }
          .flow-rev { animation: dashmove 1.4s linear infinite reverse; }
          @keyframes dashmove { to { stroke-dashoffset: -18; } }
          .pulse { animation: nodepulse 2.4s ease-in-out infinite; transform-origin: center; }
          @keyframes nodepulse { 0%,100% { opacity: .5 } 50% { opacity: 1 } }
        `}</style>

        {/* active flow connectors */}
        <Flow x1={166} x2={215} />
        <Flow x1={365} x2={414} />
        <Flow x1={564} x2={613} />
        <Flow x1={763} x2={812} color={fallback ? "#d8a25a" : "#6fd3b8"} />

        {/* active pipeline */}
        <Box cx={cols[0]} title="Browser & Daemon" sub="supply + demand" />
        <Box cx={cols[1]} title="Vercel" sub="Next route handlers" accent="teal" />
        <Box cx={cols[2]} title="coordinator · reads" sub="lib/*.ts" />
        <Box cx={cols[3]} title="lib/db seam" sub="index.ts" accent="teal" highlight />

        {/* database node (cylinder) */}
        <g>
          <g className="pulse">
            <ellipse cx={cols[4]} cy={92} rx={66} ry={11} fill="none" stroke={dbAccent === "teal" ? "#6fd3b8" : "#d8a25a"} strokeWidth={1.4} />
          </g>
          <path
            d={`M ${cols[4] - 66} 92 V 148 A 66 11 0 0 0 ${cols[4] + 66} 148 V 92`}
            fill={dbAccent === "teal" ? "rgba(111,211,184,0.08)" : "rgba(216,162,90,0.08)"}
            stroke={dbAccent === "teal" ? "#6fd3b8" : "#d8a25a"}
            strokeWidth={1.6}
          />
          <ellipse cx={cols[4]} cy={92} rx={66} ry={11} fill="rgba(111,211,184,0.05)" stroke={dbAccent === "teal" ? "#6fd3b8" : "#d8a25a"} strokeWidth={1.6} />
          <text x={cols[4]} y={120} textAnchor="middle" fill="#ecebe4" fontSize={12.5} fontWeight={600}>
            {dbLabel}
          </text>
          <text x={cols[4]} y={137} textAnchor="middle" fill="#918c81" fontSize={10} fontFamily="ui-monospace, monospace">
            {cloud && !fallback ? "AWS · region " + (status?.region ?? "—") : fallback ? "fallback active" : "embedded"}
          </text>
        </g>

        {/* branch down to the async fabric rail */}
        <path d={`M ${cols[1]} 152 V 196`} stroke="#d8a25a" strokeOpacity={0.32} strokeWidth={1.5} strokeDasharray="5 9" className="flow" />
        <line x1={150} y1={232} x2={830} y2={232} stroke="#d8a25a" strokeOpacity={0.22} strokeWidth={1} strokeDasharray="2 6" />

        {/* roadmap async fabric (simulated) */}
        <Box cx={250} y={200} h={48} w={120} title="SQS" sub="tile queue" accent="amber" />
        <Box cx={440} y={200} h={48} w={130} title="EventBridge" sub="settlement bus" accent="amber" />
        <Box cx={630} y={200} h={48} w={120} title="Fargate" sub="workers" accent="amber" />
        <Box cx={800} y={200} h={48} w={110} title="S3" sub="result blobs" accent="amber" />
        <text x={150} y={272} fill="#6a665d" fontSize={10.5} fontFamily="ui-monospace, monospace">
          Phase-3 async fabric — simulated by lib/driver.ts for the PoC
        </text>
      </svg>
    </div>
  )
}
