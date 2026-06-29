# SP1 zkVM for training attestation

**Status:** Proposed  
**Date:** 2026-05-10

## Context

Canary-loss verification is probabilistic. Enterprise customers want cryptographic guarantees.

## Decision

SP1 guest binary (`crates/mycelia-sp1-guest`) proves local SGD equivalence. Coordinator verifies proof in ~12ms before accepting Δ.

Canary-loss remains fallback when prover unavailable.

## Proof public inputs

1. `adapter_before_hash`
2. `adapter_after_hash`
3. `H` (local steps)
4. `seed`
5. `loss_after`

## Cost model

~$0.02/proof on A100 prover; cells optionally run local CPU prover (30s).

## Code

- `lib/zk/sp1-training.ts`
- `app/api/verify/zk/route.ts`
- `docs/ZK_VERIFICATION.md`
