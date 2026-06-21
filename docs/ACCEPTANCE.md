# Demo Acceptance Gate

The checklist that must pass before a demo / dry-run. Every item is a real,
runnable command — no "should work" hand-waving. Run from `frontend/` unless noted.

## A. Static gates (no server needed)

| # | Command | Pass condition |
|---|---------|----------------|
| A1 | `pnpm install` | clean install |
| A2 | `pnpm lint` | no errors |
| A3 | `pnpm build` | `✓ Compiled successfully` |
| A4 | `pnpm test` | **86 unit tests pass** (18 files) |

The unit suite covers the fractal kernel, ledger/economics, JobSpec, the
verification moat (spot-check, trusted-recompute backstop), workload policy,
the 40001 OCC retry contract, training (FedAvg/DiLoCo, canary), pipeline &
tensor parallelism (proven equivalent), compression, partitioning, referee,
Monte Carlo, inference, regions, and N-of-M replication voting.

## B. Live gates (dev server up)

Start once: `pnpm dev` (or the preview server). Then:

| # | Command | Pass condition |
|---|---------|----------------|
| B1 | `pnpm test:smoke` | **34 checks pass, 0 failed** |
| B2 | `pnpm test:statemachine` | **8 checks pass** (claim/verify lifecycle) |
| B3 | `pnpm test:fuzz` | ledger invariants hold across randomized interleavings |
| B4 | all 8 pages return 200 | `/ /dashboard /marketplace /network /verification /ledger /health /signin` |
| B5 | `GET /api/health` | `reconciliation.negativeBalances == 0` and `overspentJobs == 0` |

> Note: the public `/api/submit` path is rate-limited to 20/min/IP. `test:statemachine`
> and `test:fuzz` both submit jobs; run them ~60s apart (or after smoke) so the
> limiter doesn't trip the next suite. This is expected behavior, not a failure.

## C. The nine demo beats (see docs/DEMO.md)

1. Landing → live fractal hero assembling from real distributed tiles.
2. Submit a job in natural language → parsed to a JobSpec → escrow held.
3. Network screen: nodes claim tiles, telemetry beats over SSE.
4. A malicious node submits a bad tile → caught by self-check → **slashed**.
5. Verification (Trust) screen: stake, reputation, spot-check rate, cheats caught.
6. Earnings ledger: escrow → provider_earn + platform_fee, balances reconcile.
7. Training: a LoRA job forms a cell, rounds aggregate (DiLoCo/FedAvg), canary verifies.
8. Model-sharded parallelism: pipeline + tensor, **proven gradient-identical** to monolithic.
9. Redeem MYC → wallet flow.

## D. Resilience checks

- **Straggler reclaim:** a claimed-but-stranded tile is requeued (>12s) — see `reclaimStragglers`.
- **Sybil eviction:** a repeat cheater is banned and forfeits stake (`test:statemachine` case E).
- **Idempotency:** re-submitting a verified tile pays nothing; re-submitting a cheat does not re-slash.
- **No-key fallback:** NL submission works with no `ANTHROPIC_API_KEY` (deterministic heuristic parse).

## E. Sign-off

A demo is **GO** only when A1–A4, B1–B5 are green and the health reconciliation
is clean. If any economic invariant (B3/B5) fails, it is a **NO-GO** regardless
of how good the visuals look — the moat is the product.
