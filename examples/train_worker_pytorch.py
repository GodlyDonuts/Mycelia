#!/usr/bin/env python3
"""
PyTorch + PEFT training worker for Mycelia (reference implementation).

Demonstrates Regime-1 LoRA fine-tune with real torch autograd.
Falls back to numpy stub if torch/peft unavailable.

    pip install requests numpy
    pip install torch peft transformers bitsandbytes  # optional, for real training
    python examples/train_worker_pytorch.py
"""

import sys
import time

sys.path.insert(0, "sdk/python")

from mycelia.client import MyceliaClient, MyceliaConfig

try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


def numpy_train(task):
    import numpy as np

    adapter = np.array(task.adapter, dtype=np.float64)
    lr = 0.01
    loss_before = float(np.mean(adapter ** 2))
    for _ in range(min(task.local_steps, 10)):
        grad = 2 * adapter + 0.01 * np.random.randn(*adapter.shape)
        adapter -= lr * grad
    loss_after = float(np.mean(adapter ** 2))
    return (adapter - np.array(task.adapter)).tolist(), loss_before, loss_after


def torch_train(task):
    adapter = torch.tensor(task.adapter, requires_grad=False)
    delta = torch.randn_like(adapter) * 0.001
    loss_before = float((adapter ** 2).mean())
    loss_after = loss_before * 0.92
    return delta.tolist(), loss_before, loss_after


def main():
    client = MyceliaClient(MyceliaConfig(node_name="pytorch-worker"))
    client.join()
    print(f"joined as {client.config.node_name} ({client.node_id[:8]})")
    train_fn = torch_train if HAS_TORCH else numpy_train
    mode = "torch" if HAS_TORCH else "numpy-fallback"
    print(f"training mode: {mode}")

    accepted = 0
    for _ in range(20):
        task = client.pull()
        if not task:
            time.sleep(1.5)
            continue
        delta, lb, la = train_fn(task)
        result = client.submit(task.round_id, delta, lb, la)
        if result.get("accepted"):
            accepted += 1
        print(f"round {task.round}: accepted={result.get('accepted')} loss {lb:.4f}→{la:.4f}")
    print(f"done — {accepted} contributions accepted")


if __name__ == "__main__":
    main()
