import { NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import { base64ToBytes, type JobRenderParams } from "@/lib/fractal"
import { adjudicate } from "@/lib/referee"
import { startDriver } from "@/lib/driver"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Live refereed-delegation demo (PLAN §8): take a real verified tile as the
// honest result, forge a cheating copy that corrupts one row, and let the
// referee binary-search to the divergent row + recompute only that row to
// convict the cheater — showing logarithmic verification cost on live data.
export async function GET() {
  startDriver()
  const tile = await queryOne<{ tile_index: number; params: JobRenderParams; result_uri: string; name: string }>(
    `SELECT t.tile_index, t.params, t.result_uri, j.name
     FROM tiles t JOIN jobs j ON j.id = t.job_id
     WHERE t.status='verified' AND t.result_uri IS NOT NULL AND t.is_preseeded=false
     ORDER BY random() LIMIT 1`,
  )
  if (!tile) return NextResponse.json(null)

  const honest = base64ToBytes(tile.result_uri)
  const tilePx = tile.params.tilePx
  const cheatRow = Math.floor(tilePx / 2) + (tile.tile_index % 7)
  const cheat = honest.slice()
  for (let x = 0; x < tilePx; x++) cheat[cheatRow * tilePx + x] = (cheat[cheatRow * tilePx + x] + 61) & 255

  const r = adjudicate(tile.params, tile.tile_index, honest, cheat)
  return NextResponse.json({
    job: tile.name,
    tileIndex: tile.tile_index,
    cheatRow,
    ...r,
    // honest tile was result_uri ⇒ winner 'A' means the referee correctly cleared the honest node
    convicted: r.winner === "A" ? "challenger (B)" : r.winner === "B" ? "submitter (A)" : "inconclusive",
  })
}
