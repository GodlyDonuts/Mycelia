# Mycelia native daemon

The real off-browser **supply engine** (PLAN §3). A browser tab is throttled the
moment it's backgrounded — useless for "donate idle compute." This daemon is a
long-lived OS process that harvests idle multicore CPU 24/7.

It registers with the coordinator, pulls real deep-zoom fractal tiles, computes
them across N worker threads, submits verified results, and heartbeats — exactly
the same pull/submit API the browser worker and the simulator use, so its tiles
are verified and paid through the live ledger like any other node.

## Run

```bash
# with the app running (cd frontend && pnpm dev):
node daemon/mycelia-daemon.mjs                 # uses all-but-one core, 90% power
node daemon/mycelia-daemon.mjs --cores 4 --power 0.85 --idle
MYCELIA_URL=http://localhost:3000 node daemon/mycelia-daemon.mjs --gpu
```

| Flag | Default | Effect |
|---|---|---|
| `--url <u>` | `http://localhost:3000` (or `$MYCELIA_URL`) | coordinator base URL |
| `--name <n>` | `<hostname>-daemon` | node display name |
| `--cores <N>` | cpus − 1 | worker threads (multicore CPU) |
| `--power <0..1>` | `0.9` | duty-cycle power cap (the 80–90% trick) — cools down between tiles so CPU duty ≈ this |
| `--idle` | off | idle-only: yield (pause pulling) when 1-min load average per core > 0.7 |
| `--gpu` | off | register as a GPU-class node |

`Ctrl-C` leaves the mesh cleanly and prints a contribution summary.

## Production target

The plan's production supply engine is a **native Rust daemon** (Tauri/raw-Rust
+ `wgpu` for Vulkan/Metal/DirectX, launchd/systemd/Windows SCM background
service). This Node daemon is the runnable reference: same protocol, real
multicore CPU compute, real idle/power controls — the Rust port swaps the compute
kernel + packaging without changing the coordinator contract.
