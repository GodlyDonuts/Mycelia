#[derive(Debug, Clone)]
pub struct ActivationEnvelope {
    pub stage_from: u32,
    pub stage_to: u32,
    pub seq: u64,
    pub payload_bytes: usize,
    pub rtt_ms: u32,
}

pub fn wire_budget(hidden: usize, batch: usize, fp16: bool) -> usize {
    hidden * batch * if fp16 { 2 } else { 4 }
}

pub fn estimate_rtt_ms(region_a: &str, region_b: &str) -> u32 {
    let base = |r: &str| match r {
        "us-east-1" => 12,
        "us-west-2" => 28,
        "eu-west-1" => 95,
        _ => 50,
    };
    ((base(region_a) + base(region_b)) as f64 * 0.55) as u32
}
