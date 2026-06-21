import { NextResponse } from "next/server"
import { pullRoundTask } from "@/lib/training/coordinator"
import { startTrainingDriver } from "@/lib/training/driver"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Generic round-task pull — an external Python (PyTorch+PEFT) worker can call
// this exactly like the simulated cells do.
export async function POST(req: Request) {
  startTrainingDriver()
  try {
    const { nodeId, nodeName } = await req.json()
    if (!nodeId || !nodeName) return NextResponse.json({ ok: false, error: "nodeId+nodeName required" }, { status: 400 })
    const task = await pullRoundTask({ id: nodeId, name: nodeName })
    return NextResponse.json({ ok: true, task })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "error" }, { status: 400 })
  }
}
