import { NextResponse } from "next/server"
import { queryOne, num } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Download the trained LoRA adapter (ML_LAYER §9 acceptance criterion: "the final
// trained adapter is downloadable"). Returns the global adapter weights as a JSON
// artifact a worker could load back onto the base model.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const jobId = url.searchParams.get("jobId")
  const job = jobId
    ? await queryOne<{ id: string; name: string; base_model_ref: string; lora_config: unknown; val_loss: string | null; current_round: number; global_adapter_ref: string | null }>(
        `SELECT id,name,base_model_ref,lora_config,val_loss,current_round,global_adapter_ref FROM training_jobs WHERE id=$1`, [jobId])
    : await queryOne<{ id: string; name: string; base_model_ref: string; lora_config: unknown; val_loss: string | null; current_round: number; global_adapter_ref: string | null }>(
        `SELECT id,name,base_model_ref,lora_config,val_loss,current_round,global_adapter_ref FROM training_jobs ORDER BY (status='completed') DESC, created_at DESC LIMIT 1`)
  if (!job) return NextResponse.json({ ok: false, error: "no training job" }, { status: 404 })

  const artifact = {
    job_id: job.id,
    name: job.name,
    base_model: job.base_model_ref,
    lora_config: job.lora_config,
    rounds_trained: job.current_round,
    val_loss: job.val_loss != null ? num(job.val_loss) : null,
    adapter: job.global_adapter_ref ? JSON.parse(job.global_adapter_ref) : [],
    note: "Mycelia distributed LoRA adapter — trained across the mesh. Load onto the base model's target modules.",
  }
  return new NextResponse(JSON.stringify(artifact, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="mycelia-adapter-${job.id.slice(0, 8)}.json"`,
    },
  })
}
