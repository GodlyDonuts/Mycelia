pub struct DiLoCoConfig {
    pub h: u32,
    pub outer_lr: f64,
    pub outer_momentum: f64,
}

impl Default for DiLoCoConfig {
    fn default() -> Self {
        Self {
            h: 100,
            outer_lr: 0.7,
            outer_momentum: 0.9,
        }
    }
}

pub fn aggregate_deltas(deltas: &[Vec<f64>], weights: &[f64]) -> Vec<f64> {
    if deltas.is_empty() {
        return vec![];
    }
    let dim = deltas[0].len();
    let mut out = vec![0.0; dim];
    let w_sum: f64 = weights.iter().sum();
    if w_sum == 0.0 {
        return out;
    }
    for (d, &w) in deltas.iter().zip(weights) {
        for (i, &v) in d.iter().enumerate() {
            out[i] += v * w;
        }
    }
    out.iter_mut().for_each(|v| *v /= w_sum);
    out
}
