import { NextResponse } from "next/server"
import { renderFrame, framesInJob } from "@/lib/render3d"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const job = { id: "render-demo", sceneRef: "s3://mycelia-scenes/demo.blend", frameStart: 0, frameEnd: 23, spp: 64 }
  const frame = renderFrame(42, 0)
  return NextResponse.json({
    workload: "3D / video rendering",
    job,
    totalFrames: framesInJob(job),
    sampleFrame: frame,
    verify: "escrow-until-validated + spot-check hash",
    note: "Roadmap — Render Network-style proof-of-render on consumer GPUs.",
  })
}
