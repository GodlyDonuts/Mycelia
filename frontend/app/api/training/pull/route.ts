import { NextResponse } from "next/server"
import { pullRoundTask } from "@/lib/training/coordinator"
import { startTrainingDriver } from "@/lib/training/driver"
import { genBatch } from "@/lib/training/model"
import { TrainingPullBody } from "@/lib/contracts"
import { badRequest } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Generic round-task pull — an external Python (PyTorch+PEFT) worker calls this
// exactly like the simulated cells do. We materialize the data shard (Z, y) so
// the worker can train without reproducing the coordinator's data generator.
export async function POST(req: Request) {
  startTrainingDriver()
  const parsed = TrainingPullBody.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return badRequest("nodeId + nodeName required")
  try {
    const { nodeId, nodeName } = parsed.data
    const task = await pullRoundTask({ id: nodeId, name: nodeName })
    if (!task) return NextResponse.json({ ok: true, task: null })
    const data = genBatch(task.shard.seed, task.shard.n)
    return NextResponse.json({ ok: true, task: { ...task, data } })
  } catch (err) {
    return badRequest(err)
  }
}
