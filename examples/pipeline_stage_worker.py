#!/usr/bin/env python3
"""
Pipeline-stage worker — simulates Regime-2 stage holding W1 or w2.
Pulls stage-specific weights, runs forward/backward, ships activation envelopes.

    python examples/pipeline_stage_worker.py --stage 1
"""

import argparse
import math
import time
import uuid
import requests

BASE = "http://localhost:3000"
H, D = 6, 8


def stage1_forward(W1, z):
    return [math.tanh(sum(w * zj for w, zj in zip(row, z))) for row in W1]


def stage2_backward(w2, h, target):
    y = sum(w * hi for w, hi in zip(w2, h))
    dy = 2 * (y - target)
    gW2 = [dy * hi for hi in h]
    gH = [dy * w for w in w2]
    return y, (y - target) ** 2, gW2, gH


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", type=int, default=1, choices=[1, 2])
    args = ap.parse_args()

    name = f"pipe-s{args.stage}-{uuid.uuid4().hex[:5]}"
    node_id = requests.post(
        f"{BASE}/api/nodes/register",
        json={"name": name, "kind": "gpu", "gpuModel": "RTX4090", "region": "us-east-1"},
    ).json()["id"]
    print(f"[stage {args.stage}] joined as {name}")

    for i in range(10):
        r = requests.get(f"{BASE}/api/training/pipeline").json()
        z = [math.sin(i * 1.7 + j) for j in range(D)]
        target = math.cos(i)
        if args.stage == 1:
            # stub W1
            W1 = [[0.1 * (i + j) for j in range(D)] for i in range(H)]
            h = stage1_forward(W1, z)
            print(f"  forward seq={i} activation_bytes={len(h)*4} maxGradDiff={r.get('maxGradDiff')}")
        else:
            w2 = [0.1 * i for i in range(H)]
            h = [math.tanh(j * 0.1) for j in range(H)]
            y, loss, _, _ = stage2_backward(w2, h, target)
            print(f"  backward seq={i} loss={loss:.6f} y={y:.4f}")
        time.sleep(2)


if __name__ == "__main__":
    main()
