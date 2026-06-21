-- Mycelia core schema. Postgres-compatible (PLAN.md §5) so it runs unchanged
-- on local PGlite today and on Aurora DSQL later. Integrity is enforced in-app
-- within transactions (DSQL has no FKs); we keep it FK-free here too for parity.
-- Enums are modeled as TEXT + CHECK for portability.

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'both' CHECK (role IN ('provider','requester','both')),
  reputation  NUMERIC NOT NULL DEFAULT 50,
  region      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SERIALIZATION POINT for debits (PLAN.md §4). Every escrow_hold conditionally
-- UPDATEs this row in the same tx, so concurrent overdrafts collide.
CREATE TABLE IF NOT EXISTS account_balance (
  account_id    UUID PRIMARY KEY,
  available_myc NUMERIC NOT NULL DEFAULT 0,
  reserved_myc  NUMERIC NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nodes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID,
  display_name     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online','idle','offline')),
  kind             TEXT NOT NULL DEFAULT 'desktop' CHECK (kind IN ('browser','laptop','desktop','gpu','phone')),
  capability_class TEXT,
  cpu_class        TEXT,
  gpu_model        TEXT,
  gpu_vram_gb      NUMERIC,
  ram_gb           NUMERIC,
  capability       JSONB,
  reliability_score NUMERIC NOT NULL DEFAULT 1,
  reputation       NUMERIC NOT NULL DEFAULT 50,
  is_simulated     BOOLEAN NOT NULL DEFAULT true,
  region           TEXT,
  last_heartbeat_at TIMESTAMPTZ,
  registered_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOUNDED UPSERT, one row per node (PLAN.md §5) — not an append log.
CREATE TABLE IF NOT EXISTS node_telemetry_current (
  node_id            UUID PRIMARY KEY,
  cpu_pct            NUMERIC NOT NULL DEFAULT 0,
  gpu_pct            NUMERIC NOT NULL DEFAULT 0,
  ram_pct            NUMERIC NOT NULL DEFAULT 0,
  throughput_mbps    NUMERIC NOT NULL DEFAULT 0,
  epoch_earnings_myc NUMERIC NOT NULL DEFAULT 0,
  current_job        TEXT,
  job_progress       NUMERIC NOT NULL DEFAULT 0,
  payload            JSONB,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id      UUID,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'render'
                      CHECK (type IN ('mandelbrot','render','inference','montecarlo','sim','etl','lora')),
  params            JSONB,
  container_image_url TEXT,
  dataset_url       TEXT,
  req_vcpu          INT,
  req_gpu_model     TEXT,
  req_ram_gb        NUMERIC,
  max_runtime_s     INT,
  total_tiles       INT NOT NULL DEFAULT 0,
  completed_tiles   INT NOT NULL DEFAULT 0,
  replication_factor INT NOT NULL DEFAULT 1,
  reward_bid_myc    NUMERIC NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued','running','verifying','ready_to_settle','completed','failed')),
  result_image_uri  TEXT,
  requester_name    TEXT,
  deadline_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL,
  tile_index      INT NOT NULL,
  px0 INT, py0 INT, px1 INT, py1 INT,           -- pixel rect in the output image
  cx0 DOUBLE PRECISION, cy0 DOUBLE PRECISION,    -- complex-plane rect
  cx1 DOUBLE PRECISION, cy1 DOUBLE PRECISION,
  params          JSONB,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','claimed','dispatched','submitted','verified','failed')),
  assigned_node_id UUID,
  assigned_node_name TEXT,
  result_uri      TEXT,                          -- base64 single-channel iteration bytes (inline ≤16KB)
  result_hash     TEXT,
  checksum        TEXT,
  result_bytes    INT,
  gpu_ms          NUMERIC,
  is_preseeded    BOOLEAN NOT NULL DEFAULT false,
  claimed_at      TIMESTAMPTZ,
  dispatched_at   TIMESTAMPTZ,
  deadline_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  UNIQUE (job_id, tile_index)
);

CREATE TABLE IF NOT EXISTS tile_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_id      UUID NOT NULL,
  node_id      UUID,
  node_name    TEXT,
  result_hash  TEXT,
  result_uri   TEXT,
  gpu_ms       NUMERIC,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  vote_status  TEXT NOT NULL DEFAULT 'pending'
                 CHECK (vote_status IN ('pending','agreed','dissented','challenge_pass','challenge_fail'))
);

-- Append-only ledger. Credit balance = SUM(amount_myc) per account (PLAN.md §4).
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL,
  job_id          UUID,
  tile_id         UUID,
  amount_myc      NUMERIC NOT NULL,              -- SIGNED: debit negative, credit positive
  entry_type      TEXT NOT NULL
                    CHECK (entry_type IN ('escrow_hold','escrow_release','provider_earn','platform_fee','refund','slash')),
  idempotency_key TEXT NOT NULL UNIQUE,
  memo            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reputation_events (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id   UUID NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('pass','fail','sybil_flag','churn')),
  delta     NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_tflops    NUMERIC,
  gpus_online     INT,
  nodes_online    INT,
  jobs_running    INT,
  jobs_queued     INT,
  jobs_per_sec    NUMERIC,
  supply_units    NUMERIC,
  demand_units    NUMERIC,
  clearing_price_myc NUMERIC
);

CREATE TABLE IF NOT EXISTS net_events (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind      TEXT NOT NULL,
  node_name TEXT,
  detail    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- ML / distributed-training tables (docs/ML_LAYER.md §6) ----------------

CREATE TABLE IF NOT EXISTS training_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID,
  name            TEXT,
  base_model_ref  TEXT,
  dataset_ref     TEXT,
  lora_config     JSONB,
  h_local_steps   INT,
  max_rounds      INT,
  target_val_loss NUMERIC,
  current_round   INT NOT NULL DEFAULT 0,
  global_adapter_ref TEXT,
  val_loss        NUMERIC,
  status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','aggregating','completed','failed')),
  reward_bid_myc  NUMERIC NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_rounds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL,
  round_index     INT NOT NULL,
  adapter_ref_in  TEXT,
  adapter_ref_out TEXT,
  val_loss        NUMERIC,
  quorum_required INT,
  deltas_received INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'dispatched'
                    CHECK (status IN ('dispatched','aggregating','done','timed_out')),
  started_at      TIMESTAMPTZ DEFAULT now(),
  aggregated_at   TIMESTAMPTZ,
  UNIQUE (job_id, round_index)
);

CREATE TABLE IF NOT EXISTS contributions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id         UUID NOT NULL,
  job_id           UUID,
  node_id          UUID,
  node_name        TEXT,
  delta_ref        TEXT,
  tokens_processed BIGINT NOT NULL DEFAULT 0,
  local_steps      INT NOT NULL DEFAULT 0,
  canary_loss_delta NUMERIC,
  accepted         BOOLEAN,
  reward_myc       NUMERIC NOT NULL DEFAULT 0,
  vote_status      TEXT NOT NULL DEFAULT 'pending'
                     CHECK (vote_status IN ('pending','accepted','rejected','recompute_pass','recompute_fail')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Indexes (PLAN.md §5) --------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tiles_job_status   ON tiles(job_id, status);
CREATE INDEX IF NOT EXISTS idx_tiles_status_dl    ON tiles(status, deadline_at);
CREATE INDEX IF NOT EXISTS idx_ledger_account     ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_nodes_cap_status   ON nodes(capability_class, status);
CREATE INDEX IF NOT EXISTS idx_nodes_heartbeat    ON nodes(last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_net_events_created ON net_events(created_at DESC);
