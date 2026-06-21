import { NextResponse } from "next/server"
import { estimatePi, verifyMonteCarlo, aggregatePi, type MonteCarloResult } from "@/lib/montecarlo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// A live distributed Monte Carlo π estimation: fan out K tasks across the mesh,
// inject one tampered result, reject it via reseed-recompute, and aggregate the
// honest ones into a converged π — a second verifiable workload class, same
// escrow-until-verified discipline as render tiles.
export async function GET() {
  const K = 16
  const samples = 50_000
  const baseSeed = 0xc0ffee
  const tampered = 5

  const accepted: MonteCarloResult[] = []
  let rejected = 0
  for (let i = 0; i < K; i++) {
    const seed = baseSeed + i * 7919
    const r = estimatePi(seed, samples)
    const claimedInside = i === tampered ? r.inside + 800 : r.inside // node 5 cheats
    if (verifyMonteCarlo(seed, samples, claimedInside)) accepted.push(r)
    else rejected++
  }

  const agg = aggregatePi(accepted)
  return NextResponse.json({
    pi: Math.round(agg.pi * 1e6) / 1e6,
    error: Math.round(agg.error * 1e6) / 1e6,
    tasks: K,
    verified: accepted.length,
    rejected,
    samples: agg.samples,
  })
}
