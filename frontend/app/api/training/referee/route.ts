import { NextResponse } from "next/server"
import { initAdapter, genBatch, localTrain } from "@/lib/training/model"
import { refereeRecompute, directionalAgreement } from "@/lib/training/refereed"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Live demo of training verification beyond canary-loss (ML_LAYER §7): the
// referee re-runs claimed local SGD and convicts an untrained (random) and a
// lazy (fewer-steps) node; redundant cells on the same shard agree in direction.
export async function GET() {
  const global = localTrain(initAdapter(), genBatch(1, 100), 20, 0.08)
  const shard = { seed: 777, n: 130, steps: 30, lr: 0.08 }

  const honest = localTrain(global, genBatch(shard.seed, shard.n), shard.steps, shard.lr)
  const lazy = localTrain(global, genBatch(shard.seed, shard.n), 6, shard.lr)
  const cheat = global.map(() => Math.random())
  const redundant = localTrain(global, genBatch(shard.seed, shard.n + 50), shard.steps, shard.lr)

  return NextResponse.json({
    refereeRecompute: {
      honest: refereeRecompute(global, shard, honest),
      lazy: refereeRecompute(global, shard, lazy),
      cheat: refereeRecompute(global, shard, cheat),
    },
    directionalAgreement: {
      honestVsRedundant: directionalAgreement(global, honest, redundant),
      honestVsPoison: directionalAgreement(global, honest, global.map((g, i) => g - (honest[i] - g))),
    },
    note: "Refereed-recompute re-runs claimed SGD (deterministic); redundant cells agree in direction. Stake-weighted spot-checks make cheating negative-EV.",
  })
}
