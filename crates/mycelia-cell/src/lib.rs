//! Mycelia native training cell — Rust runtime for high-throughput LoRA workers.
//!
//! Roadmap: replaces Python reference worker for production cells needing
//! NCCL-over-LAN (tensor parallel) or sustained training throughput.

pub mod client;
pub mod compress;
pub mod diloco;
pub mod transport;

pub use client::CoordinatorClient;
