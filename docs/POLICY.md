# Mycelia — Acceptable Use, Abuse & Legal Policy

Mycelia runs **untrusted compute on volunteers' machines**, so what the network
accepts and how contributors consent are safety boundaries, not fine print. This
document states the policy; where it is **enforced in code**, the file is cited.

## 1. Allowed workloads (allowlist)

Only vetted, deterministic-or-verifiable workload classes run:

| Class | What | Verification |
|------|------|--------------|
| `render` | Deterministic fractal/tile rendering | Full self-check (byte-exact recompute) |
| `sim` | Monte Carlo / numerical simulation | Reseed-and-recompute |
| `inference` | Batched model inference | Recompute / reference comparison |
| `lora` | Distributed LoRA adapter training | Canary loss + refereed recompute + directional agreement |

Enforced: `frontend/lib/policy.ts` (`ALLOWED_WORKLOADS`) + the `JobSpec` type enum,
checked in `frontend/app/api/submit/route.ts` **before any funds escrow**.

## 2. Prohibited workloads (disallowlist)

The following are rejected at submission (HTTP 422 `WORKLOAD_NOT_ALLOWED`):

- **Crypto-mining** — mining, miners, stratum, coin-hashing.
- **Credential cracking** — hashcat/JtR, brute-force, password/WPA cracking, rainbow tables.
- **Network attack tooling** — port scanning (nmap/masscan), DDoS, botnets, exploit kits, sqlmap, metasploit.
- **Illegal content generation** — CSAM, non-consensual deepfakes, weapon-design content, terror material.

Enforced: `frontend/lib/policy.ts` (`checkWorkloadPolicy`, matched on job name/image/dataset).
This is a deliberately conservative, explicit list; it is the first gate, not the only one.

## 3. Contributor consent & privacy

- **Opt-in only.** A machine contributes compute only after the operator explicitly
  starts the browser worker or the native daemon (`daemon/`). Nothing runs in the
  background without action.
- **Capability sandbox.** Untrusted job code runs under a capability-denied sandbox
  (`frontend/lib/sandbox.ts`) — no ambient filesystem, network, or process access.
  Production hardening (Wasmtime/WASI + Firecracker/gVisor) is tracked in #31/#41.
- **Telemetry.** Only coarse operational signals (CPU/GPU class, region bucket,
  earnings) are collected. No payload contents, no personal files.
- **Age / eligibility.** Contributors must be of legal age to enter a paid
  arrangement in their jurisdiction (UI opt-in tracked in #118).

## 4. Geographic & sanctions compliance

Requester KYC and sanctioned-region geofencing are required before real-money
flows (tracked in #116). Until then MYC is an internal, non-redeemable-for-cash
credit used to demonstrate the escrow/settlement mechanics.

## 5. Economic integrity & anti-fraud

- **Escrow-until-verified.** Funds are held in escrow and only released to a
  provider when a result passes verification (`frontend/lib/coordinator.ts`).
- **Stake / slash / ban.** A wrong result forfeits stake; repeat offenders are
  **banned and forfeit all remaining stake** (`#141`, Sybil defense).
- **High-value backstop.** Job value raises the verification floor independently
  of reputation; high-value jobs force trusted recompute (`#86`).

## 6. Reporting & takedown

Suspected abuse (a job that slipped the allowlist, a malicious node, or illegal
content) should be reported to the operators; offending jobs are cancelled and
escrow refunded, offending nodes are banned. This is a demo-stage policy; a
production deployment requires a named abuse contact and an SLA for takedowns.
