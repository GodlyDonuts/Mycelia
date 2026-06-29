#!/usr/bin/env bash
# Spin up a local multi-cell training simulation for demos
set -euo pipefail

BASE="${MYCELIA_COORDINATOR:-http://localhost:3000}"
CELLS="${1:-3}"

echo "==> Mycelia training mesh demo — $CELLS cells"
echo "    Coordinator: $BASE"

for i in $(seq 1 "$CELLS"); do
  python3 examples/train_worker.py &
  echo "  started numpy worker cell-$i (pid $!)"
done

echo "==> Pipeline stage workers (Regime 2 preview)"
python3 examples/pipeline_stage_worker.py --stage 1 &
python3 examples/pipeline_stage_worker.py --stage 2 &

echo "==> Press Ctrl+C to stop all workers"
wait
