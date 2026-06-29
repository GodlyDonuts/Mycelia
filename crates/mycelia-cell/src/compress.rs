/// Top-k + int8 compression matching lib/training/compress.ts

#[derive(Debug, Clone)]
pub struct Packed {
    pub dim: usize,
    pub idx: Vec<usize>,
    pub q: Vec<i8>,
    pub scale: f64,
}

pub fn compress(vec: &[f64], k: usize) -> Packed {
    let dim = vec.len();
    let kk = k.max(1).min(dim);
    let mut order: Vec<usize> = (0..dim).collect();
    order.sort_by(|&a, &b| vec[b].abs().partial_cmp(&vec[a].abs()).unwrap());
    let mut idx: Vec<usize> = order[..kk].to_vec();
    idx.sort_unstable();
    let max_abs = idx.iter().map(|&i| vec[i].abs()).fold(0.0_f64, f64::max);
    let scale = if max_abs > 0.0 { max_abs / 127.0 } else { 1.0 };
    let q: Vec<i8> = idx
        .iter()
        .map(|&i| (vec[i] / scale).round().clamp(-127.0, 127.0) as i8)
        .collect();
    Packed { dim, idx, q, scale }
}

pub fn decompress(p: &Packed) -> Vec<f64> {
    let mut out = vec![0.0; p.dim];
    for (j, &i) in p.idx.iter().enumerate() {
        out[i] = p.q[j] as f64 * p.scale;
    }
    out
}

pub fn packed_bytes(p: &Packed) -> usize {
    p.idx.len() * 2 + p.idx.len() + 4
}
