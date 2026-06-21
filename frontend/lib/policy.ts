// Workload policy: the marketplace runs untrusted code on volunteers' machines,
// so what it accepts is a safety boundary, not just a product choice (PLAN §10
// "allowed-workload allowlist" #111 + "disallowed-workload checks" #114).
//
// Two gates, both enforced server-side before a job can escrow funds:
//   1. ALLOWLIST  — only vetted, deterministic-or-verifiable workload classes run.
//   2. DISALLOWLIST — reject anything matching a prohibited pattern (mining,
//      credential cracking, network scanning, illegal content) on name/image/dataset.
// A job must pass both. The check is pure (string-only), so it's unit-testable
// and runs identically in the NL path and the raw /submit path.

export const ALLOWED_WORKLOADS = ["render", "inference", "sim", "lora"] as const

// Prohibited-workload signatures. Matched case-insensitively against the job's
// name + image + datasetUrl. Kept conservative and explicit — each entry maps to
// a category in #114 (crypto-mining, cracking, port-scan, illegal content).
const DISALLOWED: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(crypto|bitcoin|ethereum|monero|xmrig|ethminer|nicehash|mining|miner|hashcat-coin|stratum)\b/i, reason: "crypto-mining is not an allowed workload" },
  { pattern: /\b(hashcat|john[\s-]?the[\s-]?ripper|johntheripper|brute[\s-]?force|password[\s-]?crack|credential[\s-]?stuff|wpa[\s-]?crack|rainbow[\s-]?table)\b/i, reason: "credential cracking is prohibited" },
  { pattern: /\b(nmap|masscan|port[\s-]?scan|portscan|ddos|dos[\s-]?attack|botnet|exploit[\s-]?kit|sqlmap|metasploit)\b/i, reason: "network scanning / attack tooling is prohibited" },
  { pattern: /\b(csam|cp|child[\s-]?(porn|abuse|exploit)|terror|bioweapon|chemical[\s-]?weapon|deepfake[\s-]?(porn|nude)|nonconsensual)\b/i, reason: "illegal content generation is prohibited" },
]

export interface PolicyVerdict {
  ok: boolean
  reason?: string
}

/** Enforce both the allowlist and the disallowlist. Pure / string-only. */
export function checkWorkloadPolicy(job: { type: string; name?: string; image?: string; datasetUrl?: string }): PolicyVerdict {
  if (!ALLOWED_WORKLOADS.includes(job.type as (typeof ALLOWED_WORKLOADS)[number])) {
    return { ok: false, reason: `workload type "${job.type}" is not on the vetted allowlist (${ALLOWED_WORKLOADS.join(", ")})` }
  }
  const haystack = `${job.name ?? ""} ${job.image ?? ""} ${job.datasetUrl ?? ""}`
  for (const { pattern, reason } of DISALLOWED) {
    if (pattern.test(haystack)) return { ok: false, reason }
  }
  return { ok: true }
}

// Largest result blob a node may submit for a single tile. Beyond the inline
// rule (#131), this is an early DoS guard: an oversized payload is rejected
// before it's base64-decoded or recomputed (#35). Tiles are tiny (a 64×64×4
// fractal tile is ~16KB); 256KB is a generous ceiling.
export const MAX_RESULT_BYTES = 256 * 1024
export const MAX_RESULT_B64 = Math.ceil(MAX_RESULT_BYTES / 3) * 4 + 4
