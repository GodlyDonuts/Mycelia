// Communication compression for the training outer loop (docs/ML_LAYER.md §5
// "Roadmap: delta compression" — DeMo/DisTrO lineage). The bytes we ship between
// cells are the binding constraint over home internet, so we compress the adapter
// pseudo-gradient: top-k sparsification + int8 quantization, with ERROR FEEDBACK
// (accumulate what compression dropped and fold it into the next round) so heavy
// compression doesn't hurt convergence.

export interface Packed {
  dim: number
  idx: number[] // indices of the kept (largest-magnitude) entries
  q: number[] // int8-quantized values for those entries
  scale: number // dequantization scale
}

export function denseBytes(dim: number): number {
  return dim * 4 // float32
}
export function packedBytes(p: Packed): number {
  return p.idx.length * 2 + p.q.length + 4 // uint16 index + int8 value + a float32 scale
}

/** Top-k sparsify + int8-quantize a vector. */
export function compress(vec: number[], k: number): Packed {
  const dim = vec.length
  const kk = Math.max(1, Math.min(k, dim))
  // indices of the k largest-magnitude entries
  const idx = Array.from({ length: dim }, (_, i) => i)
    .sort((a, b) => Math.abs(vec[b]) - Math.abs(vec[a]))
    .slice(0, kk)
    .sort((a, b) => a - b)
  let maxAbs = 0
  for (const i of idx) maxAbs = Math.max(maxAbs, Math.abs(vec[i]))
  const scale = maxAbs > 0 ? maxAbs / 127 : 1
  const q = idx.map((i) => Math.max(-127, Math.min(127, Math.round(vec[i] / scale))))
  return { dim, idx, q, scale }
}

/** Reconstruct a dense vector from a packed delta. */
export function decompress(p: Packed): number[] {
  const out = new Array(p.dim).fill(0)
  for (let j = 0; j < p.idx.length; j++) out[p.idx[j]] = p.q[j] * p.scale
  return out
}

/**
 * Compress `vec + residual` (error feedback), returning the packed payload and
 * the NEW residual = what compression failed to send this round. Feeding the
 * residual back next round is what preserves convergence under heavy compression.
 */
export function compressWithFeedback(vec: number[], residual: number[], k: number): { packed: Packed; residual: number[] } {
  const acc = vec.map((v, i) => v + (residual[i] ?? 0))
  const packed = compress(acc, k)
  const sent = decompress(packed)
  const newResidual = acc.map((v, i) => v - sent[i])
  return { packed, residual: newResidual }
}
