//! SP1 guest binary: training_attest
//!
//! Public inputs: adapter_before_hash, adapter_after_hash, H, seed, loss_after
//! Private inputs: shard samples, SGD trajectory
//!
//! Roadmap — not compiled in CI (requires SP1 toolchain).

#![no_main]
sp1_zkvm::entrypoint!(main);

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct Witness {
    adapter_before: Vec<i64>,
    adapter_after: Vec<i64>,
    local_steps: u32,
    seed: u64,
    loss_after: i64,
}

pub fn main() {
    let witness: Witness = sp1_zkvm::io::read();
    // Deterministic SGD verification loop would run here
    let _valid = witness.adapter_after.len() == witness.adapter_before.len();
    sp1_zkvm::io::commit(&witness.loss_after);
}
