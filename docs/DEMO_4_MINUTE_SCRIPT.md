# Mycelia — Four-Minute Demo Script

This is the primary stage script. It is written for one presenter operating the app while speaking.

## Before you go on stage

Run these steps at least two minutes before the presentation:

1. From `frontend/`, run `pnpm dev` and open `http://localhost:3000`.
2. Open **Network** for 15–20 seconds so the render and training loops warm up.
3. Confirm the **Live Render** is progressing and **Distributed Training** has a falling loss curve.
4. Return to the landing page and scroll to the top.
5. Use a desktop-width browser at 100% zoom. Close DevTools and unrelated tabs.
6. Stay signed out or use a Requester/Both account. A Provider-only account cannot submit jobs.
7. Keep `/health` open in a second tab as the emergency fallback.

Do not reset or restart the server immediately before presenting; that discards the warmed in-memory demo state.

## The four-minute run

### 0:00–0:35 — The problem

**On screen:** Landing page, hero fully visible.

**Action:** Do not touch the mouse for the opening sentence. Then gesture toward the live statistics below the hero.

**Say:**

> AI needs extraordinary compute. Our default answer is ever-larger datacenters—concentrating land, power, cooling, and capital in facilities communities increasingly reject.
>
> Meanwhile, millions of capable GPUs and CPUs sit idle for most of the day. Mycelia turns that stranded capacity into a shared cloud. Our goal is one million participants whose machines add capacity instead of requiring another megadatacenter.

**Action at 0:28:** Scroll just enough to reveal the live stats band.

**Point to:** Active nodes, GPUs, network compute, and running jobs. Say, “These values come from the live coordinator, not a slide.”

---

### 0:35–1:15 — Demand enters the marketplace

**Action:** Click **Submit a job** in the hero, or click **Marketplace** in the sidebar.

**On screen:** Marketplace supply/demand band and natural-language job box.

**Say:**

> On one side is demand. A researcher, studio, or small company should not need a cloud-infrastructure team just to buy compute. They describe the outcome they need in plain English.

**Action:** Click the natural-language box and enter exactly:

> Render a 4K deep-zoom fractal across the network

Click the arrow button. As the structured form fills, continue:

> Mycelia turns that request into a validated job specification: workload, hardware class, memory, runtime, replication, and a fair reward. The market above is live supply and outstanding work, so pricing responds to actual network pressure.

**Action:** Scroll to the **Submit job** button and click it once.

**Say:**

> When I submit, the reward moves into escrow atomically. Providers cannot be paid merely for claiming work; the network has to verify the result first.

**Wait for:** “Escrow funded” and a job ID. Do not read the ID aloud.

---

### 1:15–2:10 — Supply joins and performs real work

**Action:** Click **Network** in the sidebar.

**On screen:** Network statistics, **Join the mesh**, topology, and live render.

**Say:**

> The other side is supply. Any ordinary machine can become a contributor—a cultivator in the Mycelia network. Workers pull independent shards through stateless endpoints, so the millionth user adds compute instead of one more permanent connection to a central scheduler.

**Action:** Click **Join the mesh**.

If the consent panel appears, check the consent box and click **Agree & join** while saying:

> Contribution is opt-in, resource-capped, and reversible. The owner stays in control.

**Point to:** Mode, tiles, time per tile, and MYC earned.

**Say:**

> This browser is now computing a real fractal tile using WebGPU, with a CPU worker as the fallback. It pulls work from the coordinator, computes locally, submits the result, and earns only after verification.

**Point to the graph and live render:**

> This is the active mesh. Independently computed tiles are checked and reassembled on the right. It is not a video—the pixels return through the same job and settlement path a real worker uses.

---

### 2:10–2:50 — Show that this is more than rendering

**Action:** Scroll down to **Distributed Training**.

**Say:**

> Rendering is easiest to see, but the model also applies to AI. These machines fine-tune a LoRA adapter locally, exchanging small updates instead of synchronizing the entire model every step.

**Point to:** Falling validation loss, contribution bars, communication footer, and any “delta rejected” badge.

**Say:**

> The loss is genuinely falling round by round. Contributions are weighted by useful work, compressed for home internet, and bad updates are rejected by a canary-loss check.
>
> Mycelia is not claiming that every tightly coupled supercomputer workload belongs on home Wi-Fi. It targets work that can spread efficiently: rendering, inference batches, simulations, parameter sweeps, and communication-efficient fine-tuning.

---

### 2:50–3:30 — Trust is the product

**Action:** Click **Trust** in the sidebar.

**On screen:** Trust and economics dashboard.

**Say:**

> A distributed marketplace only works if strangers cannot get paid for bad results. That is why verification is not an add-on here—it is the product.

**Point to:** Sellable fraction, stake at risk, cheats slashed, and refereed recompute.

**Say:**

> Mycelia combines deterministic checks, reputation, stake, and selective recomputation. Suspicious work is challenged; dishonest nodes lose stake and reputation. Refereed recomputation finds the first divergence instead of rerunning the entire job, so trust stays cheaper than the compute being sold.

---

### 3:30–4:00 — Settlement and close

**Action:** Click **Earnings** in the sidebar.

**On screen:** Ledger totals, balances, and recent entries.

**Say:**

> And this closes the loop. The requester funds escrow, useful work is verified, contributors are paid, and the platform fee is recorded in an append-only ledger. Every number on this screen comes from that live transaction path.
>
> Datacenters will still exist. But we should not pour concrete for every parallel workload while enormous capacity sits unused. Mycelia lets one million people make that capacity discoverable, trustworthy, and useful—many small machines, one living compute cloud.

**Final action:** Stop moving the mouse. End on the ledger with the live MYC balance visible.

## Stage-action checklist

| Time | Screen | Action | Proof shown |
|---|---|---|---|
| 0:00 | Landing | Hold, then reveal stats | Live coordinator totals |
| 0:35 | Marketplace | Parse prompt and submit | Typed job, market pressure, escrow |
| 1:15 | Network | Join mesh | Real browser compute and earnings |
| 1:45 | Network | Point to graph/render | Fan-out, verification, reassembly |
| 2:10 | Network | Scroll to training | Falling loss and rejected bad delta |
| 2:50 | Trust | Open trust dashboard | Stake, slashing, efficient challenge |
| 3:30 | Earnings | Open ledger | Escrow-to-verified-payment loop |
| 4:00 | Earnings | Stop | Final thesis |

## Recovery lines

Use one sentence and move on; never debug on stage.

- **Natural-language parsing takes longer than three seconds:** “The request is being validated against the same schema that protects the coordinator.” If it still stalls, use the pre-filled structured form or move to Network.
- **Submit is rejected:** “The marketplace also enforces role and balance constraints server-side.” Move to Network; the pre-seeded render already proves the execution path.
- **WebGPU is unavailable:** “This machine has selected the CPU worker—the protocol is hardware-independent.” Continue normally.
- **No tile is immediately assigned:** “The worker is connected and waiting for the next eligible shard.” Point to the already-running live render.
- **Training is between rounds:** Point to the existing curve and say, “These are the completed validation rounds; the next cell aggregation is in progress.”
- **Any screen looks wrong:** Switch to the prepared **Health** tab, point to “invariants hold,” and say, “This is the operator view: ledger reconciliation, worker liveness, and workload health in one place.”

## Delivery notes

- Speak at approximately 125–135 words per minute. The spoken script is intentionally about 520 words.
- Pause after “communities increasingly do not want in their backyards” and after the final sentence.
- Do not call the system “decentralized AWS” or claim it replaces hyperscale pretraining.
- Say “designed for one million participants,” not “currently serving one million users.” The scale path is concrete; the million-user load test is future validation.
- Do not explain PGlite unless asked. If asked: “The demo uses embedded Postgres; the data-access boundary is designed to swap to Aurora DSQL without changing coordinator logic.”
- If asked whether the fleet is real: “The browser I joined is real. The local demo also includes a deterministic seeded fleet so the marketplace remains active without external infrastructure.”
