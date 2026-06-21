#!/usr/bin/env python3
"""
Mycelia external training worker (reference).

Demonstrates that the distributed-training backend's pull/contribute API is open:
a real worker (here numpy; in production PyTorch + PEFT + bitsandbytes) joins the
mesh, pulls a round-task with its data shard, runs local SGD on the trainable
adapter, and submits the delta. The coordinator's canary-loss check verifies it
and the ledger pays it — exactly like the simulated cells.

    pip install requests numpy
    # with the dev server running (cd frontend && pnpm dev):
    python examples/train_worker.py
"""

import time
import uuid
import numpy as np
import requests

BASE = "http://localhost:3000"


def main():
    name = "py-worker-" + uuid.uuid4().hex[:5]
    node_id = requests.post(
        f"{BASE}/api/nodes/register",
        json={"name": name, "kind": "gpu", "gpuModel": "A100"},
    ).json()["id"]
    print(f"joined the mesh as {name} ({node_id[:8]})")

    accepted = 0
    while True:
        r = requests.post(
            f"{BASE}/api/training/pull", json={"nodeId": node_id, "nodeName": name}
        ).json()
        task = r.get("task")
        if not task:
            time.sleep(1.5)
            continue

        # the frozen-base features (Z) + labels (y) for this shard
        Z = np.array(task["data"]["Z"], dtype=float)
        y = np.array(task["data"]["y"], dtype=float)
        theta = np.array(task["theta"], dtype=float)
        steps = int(task["shard"]["steps"])
        lr = float(task["shard"]["lr"])
        n = len(y)

        # local SGD on the trainable adapter — MSE gradient (2/n) Zᵀ(Zθ − y),
        # byte-for-byte the same objective as lib/training/model.localTrain
        for _ in range(steps):
            grad = (2.0 / n) * (Z.T @ (Z @ theta - y))
            theta = theta - lr * grad

        out = requests.post(
            f"{BASE}/api/training/submit-contribution",
            json={
                "cellId": task["cellId"],
                "roundId": task["roundId"],
                "jobId": task["jobId"],
                "nodeId": node_id,
                "nodeName": name,
                "localTheta": theta.tolist(),
                "tokens": n,
                "localSteps": steps,
            },
        ).json()

        if out.get("accepted"):
            accepted += 1
        print(
            f"round {task['roundIndex']:>2} · {'ACCEPTED' if out.get('accepted') else 'rejected'} "
            f"· canaryΔ {out.get('canaryLossDelta')} · total accepted {accepted}"
        )
        time.sleep(0.2)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nleft the mesh")
