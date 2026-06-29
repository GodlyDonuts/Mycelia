# Mycelia — Demo Walkthrough

For the rehearsed stage presentation, use the exact [four-minute demo script](DEMO_4_MINUTE_SCRIPT.md). This document is the longer feature-by-feature walkthrough.

A concrete, click-by-click script for demoing the **built** app (the PLAN §9 beat sheet, adapted to what actually runs). Everything below is live against the local PGlite-backed system — no AWS, no external services required.

## Setup (30s before)

```bash
cd frontend && pnpm install && pnpm dev      # http://localhost:3000
# optional: export ANTHROPIC_API_KEY=sk-ant-...  for live Claude NL submission
```

Open `http://localhost:3000`. The in-memory DB migrates + seeds on the first request (a populated mesh + an in-progress render), so every screen is alive immediately. Opening **Network** or **Trust** starts the in-process simulator (renders + training + cheats), so leave one open ~10s before you present to warm the loops.

## The beats

1. **Hook (landing, `/`)** — "What if the next million compute users added capacity instead of requiring another datacenter? Mycelia grows a shared cloud from the machines we already have." The hero stats band is live (`/api/stats`). Describe the system as **designed for one million participants**; do not imply the local demo has already load-tested one million concurrent users.

2. **The marketplace (`/marketplace`)** — point at the live **supply vs demand** band. Type one plain-English sentence into *Describe your job* — e.g. *"render a 4K deep zoom into the seahorse valley, under two minutes, keep it cheap"* — and watch a schema-valid job stream into the form (Claude Opus 4.8 structured output with `ANTHROPIC_API_KEY`, deterministic fallback otherwise). Click **Submit job**: escrow is debited atomically and the job fans out → *"Escrow funded · job … fanned out to the mesh."*

3. **Join the mesh (`/network`)** — click **Join the mesh**. A real browser node appears and computes **real deep-zoom fractal tiles** via a WGSL **WebGPU** compute shader (with live per-tile GPU time; CPU Web Worker fallback otherwise). Watch the **Live Render** canvas reassemble tile-by-tile from genuinely-computed pixels, then hit **png** to download the reassembled image.

4. **Distributed training (`/network`, scroll down)** — the **Distributed Training** panel shows a real LoRA fine-tune: the validation-loss curve dropping round-by-round, token-weighted contribution bars, and the **"Δ rejected"** count (the canary-loss check rejecting bad deltas). The footer shows the **communication compression** ratio (top-k + int8 + error feedback, ~67× on a LoRA r16 adapter). Download the trained adapter via the **adapter** link. (An external worker can join too: `python examples/train_worker.py`.) Below, the **Compute workloads** registry + a second live verifiable workload, **Monte Carlo π**.

   *Off-browser supply:* run the native daemon — `node daemon/mycelia-daemon.mjs --cores 4 --idle` — and watch a real multicore OS process contribute hundreds of tiles (no tab throttling). See [`daemon/README.md`](../daemon/README.md).

5. **Credits + ledger + cash-out (`/ledger`)** — the header MYC chip ticks up on real verified work. The **Earnings** screen shows escrow held, paid-to-providers, platform fees, per-account balances, and a live ledger feed — escrow-until-verified, end to end. Scroll to **Redeem MYC**: cash out to bank / gift-card / crypto (balance-gated, with the tax/KYC disclosure).

6. **The moat (`/verification`)** — the punchline, now a full trust+economics dashboard:
   - **Sellable fraction / verification tax / stake at risk / cheats slashed**, and the live **unit-economics table** (NET/node-hour across proven/unproven × cheap/expensive power).
   - **Region-aware payouts** — NET per region with off-peak/renewable bonuses.
   - **Refereed-delegation recompute** — a live challenge convicting a cheater in ~6 binary-search steps + 1 row recompute (64× cheaper than full recompute).
   - **Host protection** — untrusted kernels run capability-denied (fs/net/process blocked) with a hard time cap.

7. **Sign in / roles (`/signin`)** — pick Requester / Provider / Both. A signed-in Provider is blocked from submitting jobs (role-gated server-side); the header shows your identity.

8. **Agentic surface (MCP)** — point an MCP client at `POST /api/mcp` (JSON-RPC). Seven read-only tools: `get_mesh_status`, `list_nodes`, `get_job_progress`, `explain_settlement`, `get_market`, `get_training_status`, `get_economics`. The agent can read the mesh and explain a settlement; it can never authorize a payment.

   ```bash
   curl -s -X POST localhost:3000/api/mcp -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_economics","arguments":{}}}'
   ```

9. **On-stage health (`/health`)** — the runbook view: the ledger **reconciliation sweep** ("invariants hold"), render/training status, mesh liveness, trust counters, per-worker heartbeat. If anything looks off mid-demo, this is where you see it.

## Resilience notes (what keeps it alive)

- The simulator perpetually rolls fresh renders + training jobs, so the screens never go idle.
- A dropped browser node can't stall a render: stranded tiles are **reclaimed** after 12s and recomputed by the mesh.
- Cheating nodes are caught by the deterministic self-check and **slashed**; the render still completes.
- No `ANTHROPIC_API_KEY`? NL submission falls back to a deterministic parser — the demo still works.

## Proof it's real, not a mock

```bash
cd frontend
pnpm test          # 52 Vitest unit tests (kernel, training, referee, compression, pipeline, sandbox, auth, economics, Monte Carlo, regions)
pnpm test:smoke    # 29 live checks: escrow, overdraft, cheat-rejection + slash, verify+pay,
                   # idempotency, training, reconciliation, refereed recompute, Monte Carlo,
                   # role gating, redemption, hardening, MCP
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for how it all works and the Aurora DSQL swap path.
