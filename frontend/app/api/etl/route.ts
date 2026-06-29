import { NextResponse } from "next/server"
import { runEtl, redundantAgree } from "@/lib/etl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const task = { id: "etl-demo", sourceUrl: "https://example.com/data", selector: "table.rows", expectedRows: 100, seed: 1337 }
  const r1 = runEtl(task)
  const r2 = runEtl(task)
  return NextResponse.json({
    workload: "Data ETL / scraping",
    task: { id: task.id, expectedRows: task.expectedRows },
    result: r1,
    redundantAgreement: redundantAgree([r1, r2]),
    note: "Roadmap — public-data only; redundant nodes must agree on content hash.",
  })
}
