# Multi-Region Training Topology

> How Mycelia partitions training cells across AWS regions for latency + compliance.

## Region map

| Region | Role | TURN pool | DSQL read replica |
|--------|------|-----------|-------------------|
| us-east-1 | Primary coordinator | ✓ | leader |
| us-west-2 | West coast cells | ✓ | async replica |
| eu-west-1 | GDPR partition | ✓ | async replica |
| ap-southeast-1 | APAC cells | ✓ | async replica |

## Cell placement policy

1. **Regime 1 (single-GPU LoRA):** cell = 1 node anywhere; outer sync is adapter-only (MB-scale).
2. **Regime 2 (pipeline):** all stages of a cell must be in the **same metro** (< 5 ms inter-stage RTT).
3. **Cross-region outer sync:** allowed; DiLoCo H=100+ amortizes WAN latency.

## Data residency

- EU cells train only on EU-sharded data (S3 bucket `mycelia-datasets-eu`)
- Checkpoint blobs replicated async; coordinator routes by `region` claim on node registration

## Failover

```
us-east-1 coordinator unavailable
        │
        ▼
Route 53 health check fails (30s)
        │
        ▼
Promote us-west-2 read replica → leader
        │
        ▼
Cells reconnect via gossip delta fallback (outer loop)
```

## Code map

- `lib/regions.ts` — payout + routing
- `lib/p2p/ice-config.ts` — regional TURN
- `infra/terraform/multi-region/` — Aurora DSQL + Route53 (roadmap)

## Status

Region-aware **payouts** are live. Multi-region **coordinator failover** and **DSQL replicas** are roadmap (PGlite single-node today).
