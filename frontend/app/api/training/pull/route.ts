import { NextResponse } from "next/server"
import { pullRoundTask } from "@/lib/training/coordinator"
import { startTrainingDriver } from "@/lib/training/driver"
import { TrainingPullBody } from "@/lib/contracts"
import { badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Generic round-task pull — an external Python (PyTorch+PEFT) worker can call
// this exactly like the simulated cells do.
export async function POST(req: Request) {
  startTrainingDriver()
  const parsed = TrainingPullBody.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("nodeId + nodeName required")
  try {
    const { nodeId, nodeName } = parsed.data
    const task = await pullRoundTask({ id: nodeId, name: nodeName })
    return NextResponse.json({ ok: true, task })
  } catch (err) {
    return badRequest(err)
  }
}
