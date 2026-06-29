"""
Mycelia Python SDK — distributed training client.

Production workers use this to join the mesh, pull rounds, and submit LoRA deltas.
Requires: requests, numpy; optional: torch, peft, bitsandbytes for real training.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

import requests


@dataclass
class MyceliaConfig:
    base_url: str = "http://localhost:3000"
    node_name: str = field(default_factory=lambda: f"py-sdk-{uuid.uuid4().hex[:6]}")
    gpu_model: str = "RTX4090"
    region: str = "us-east-1"
    poll_interval_sec: float = 1.5


@dataclass
class TrainingTask:
    round_id: str
    round: int
    adapter: list[float]
    shard_index: int
    sample_count: int
    local_steps: int
    raw: dict[str, Any]


class MyceliaClient:
    """High-level SDK for the training coordinator API."""

    def __init__(self, config: Optional[MyceliaConfig] = None):
        self.config = config or MyceliaConfig()
        self._node_id: Optional[str] = None

    @property
    def node_id(self) -> str:
        if not self._node_id:
            raise RuntimeError("call join() first")
        return self._node_id

    def join(self) -> str:
        r = requests.post(
            f"{self.config.base_url}/api/nodes/register",
            json={
                "name": self.config.node_name,
                "kind": "gpu",
                "gpuModel": self.config.gpu_model,
                "region": self.config.region,
            },
            timeout=30,
        )
        r.raise_for_status()
        self._node_id = r.json()["id"]
        return self._node_id

    def pull(self) -> Optional[TrainingTask]:
        r = requests.post(
            f"{self.config.base_url}/api/training/pull",
            json={"nodeId": self.node_id, "nodeName": self.config.node_name},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        task = data.get("task")
        if not task:
            return None
        return TrainingTask(
            round_id=task["roundId"],
            round=task["round"],
            adapter=task["adapter"],
            shard_index=task.get("shardIndex", 0),
            sample_count=task.get("sampleCount", 32),
            local_steps=task.get("localSteps", 100),
            raw=task,
        )

    def submit(
        self,
        round_id: str,
        delta: list[float],
        loss_before: float,
        loss_after: float,
    ) -> dict[str, Any]:
        r = requests.post(
            f"{self.config.base_url}/api/training/submit-contribution",
            json={
                "nodeId": self.node_id,
                "roundId": round_id,
                "delta": delta,
                "lossBefore": loss_before,
                "lossAfter": loss_after,
            },
            timeout=30,
        )
        r.raise_for_status()
        return r.json()

    def run_forever(self, train_fn):
        """train_fn(task) -> (delta, loss_before, loss_after)"""
        if not self._node_id:
            self.join()
        while True:
            task = self.pull()
            if not task:
                time.sleep(self.config.poll_interval_sec)
                continue
            delta, lb, la = train_fn(task)
            result = self.submit(task.round_id, delta, lb, la)
            yield {"task": task, "result": result}


def compress_topk(delta: list[float], k_frac: float = 0.02) -> dict:
    """Client-side top-k preview matching lib/training/compress.ts."""
    import numpy as np

    arr = np.array(delta)
    k = max(1, int(len(arr) * k_frac))
    idx = np.argsort(np.abs(arr))[-k:]
    idx.sort()
    scale = float(np.max(np.abs(arr[idx]))) / 127 or 1.0
    q = np.clip(np.round(arr[idx] / scale), -127, 127).astype(int).tolist()
    return {"dim": len(arr), "idx": idx.tolist(), "q": q, "scale": scale}
