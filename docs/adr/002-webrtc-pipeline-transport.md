# WebRTC over home NAT for pipeline activations

**Status:** Proposed  
**Date:** 2026-04-02

## Context

Regime-2 cells exchange activations every micro-step. Home NAT prevents ~35% of direct peer connections.

## Decision

Coordinator-mediated WebRTC signaling + regional coturn TURN pools on Fargate.

Adaptive int8 activation compression when BWE < 20 Mbps (`lib/p2p/bandwidth-estimator.ts`).

## Alternatives rejected

- **Central relay for all traffic** — bandwidth cost at scale
- **VPN mesh (Tailscale)** — friction for consumer suppliers
- **QUIC over coordinator** — adds latency vs P2P

## Implementation

- `proto/p2p/v1/signaling.proto`
- `lib/p2p/webrtc-mesh.ts`
- `daemon/p2p-relay.mjs` (dev stub)
- `infra/terraform/turn/`
