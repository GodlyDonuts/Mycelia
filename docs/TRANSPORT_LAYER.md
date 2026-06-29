# Distributed Training Transport Layer

> Internal reference for P2P activation exchange between pipeline stages (Regime 2).

## Overview

When a model exceeds single-GPU VRAM, a **cell** becomes a pipeline of nodes. Each micro-batch forward pass ships **activations** stage→stage; backward pass ships **activation gradients** in reverse. This is the bandwidth-critical inner loop — distinct from the outer DiLoCo adapter sync.

## Stack

```
┌─────────────────────────────────────────────────────────────┐
│  Stage N forward  ──activation tensor──▶  Stage N+1         │
│  Stage N backward ◀──activation grad────  Stage N+1         │
├─────────────────────────────────────────────────────────────┤
│  WebRTC DataChannel (ordered, SCTP)                         │
│  Fallback: TURN relay (coturn on Fargate)                   │
│  Signaling: coordinator WebSocket (/api/p2p/signaling)      │
├─────────────────────────────────────────────────────────────┤
│  Adaptive compression: int8 activations when BWE < 20 Mbps  │
│  (lib/p2p/bandwidth-estimator.ts)                           │
└─────────────────────────────────────────────────────────────┘
```

## Wire budget (Llama 70B, TP=4)

| Tensor | Shape (micro-batch=1) | fp16 bytes | int8 bytes |
|--------|----------------------|------------|------------|
| Hidden state | 8192 | 16 KB | 8 KB |
| Attention output | 8192 | 16 KB | 8 KB |
| MLP intermediate | 28672 | 57 KB | 29 KB |

At 120 Mbps home uplink, fp16 hidden activations add ~1.1 ms RTT-equivalent latency per hop.

## ICE topology

- **STUN**: Google public + Mycelia edge STUN
- **TURN**: Regional coturn pools (`turn-{region}.mycelia.internal`)
- **Direct**: ~65% of consumer NAT pairs (empirical target)
- **Relay**: ~35% require TURN; 1.35× RTT overhead

## Failure modes

| Event | Mitigation |
|-------|------------|
| ICE failed | Auto-retry via TURN; coordinator assigns relay region |
| Stage straggler | SWIM suspect → eject; micro-batch pipeline drain |
| DC backpressure | Reduce micro-batch; escalate to int8 wire format |
| Partition | Gossip delta fallback (outer loop only) |

## Code map

| Module | Role |
|--------|------|
| `lib/training/transport.ts` | Envelope + wire budget math |
| `lib/p2p/webrtc-mesh.ts` | Signaling session lifecycle |
| `lib/p2p/ice-config.ts` | STUN/TURN bundles |
| `lib/p2p/bandwidth-estimator.ts` | Adaptive dtype selection |
| `daemon/p2p-relay.mjs` | Native relay peer (roadmap) |

## Status

**Proof stubs:** wire budget + BWE + signaling session model (in-process).  
**Roadmap:** live WebRTC in browser worker + native daemon relay.
