// Tensor parallelism (docs/ML_LAYER.md §3: "splitting individual matmuls across
// nodes"). A matmul Y = X·W is sharded two ways:
//   • column-parallel: split W by columns, each shard computes a column block of
//     Y, then concat (no reduction).
//   • row-parallel: split W by rows and X by columns, each shard computes a
//     partial product, then all-reduce (sum).
// Both produce the SAME Y as a single node — that equivalence is the correctness
// property. (Tensor-parallel is bandwidth-brutal ⇒ intra-LAN/intra-node only;
// here the shards are functions, so it's verifiable in-process.)

export type Matrix = number[][]

export function matmul(X: Matrix, W: Matrix): Matrix {
  const m = X.length, k = X[0].length, n = W[0].length
  const Y: Matrix = Array.from({ length: m }, () => new Array(n).fill(0))
  for (let i = 0; i < m; i++) for (let p = 0; p < k; p++) { const x = X[i][p]; const wr = W[p]; for (let jc = 0; jc < n; jc++) Y[i][jc] += x * wr[jc] }
  return Y
}

function splitRanges(total: number, shards: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  const base = Math.floor(total / shards)
  let extra = total % shards
  let start = 0
  for (let s = 0; s < shards; s++) {
    const len = base + (extra > 0 ? 1 : 0)
    if (extra > 0) extra--
    out.push([start, start + len])
    start += len
  }
  return out
}

/** Column-parallel: shard s computes Y[:, cols_s] = X · W[:, cols_s]; concat. */
export function columnParallel(X: Matrix, W: Matrix, shards: number): Matrix {
  const n = W[0].length
  const blocks = splitRanges(n, shards).map(([c0, c1]) => {
    const Wsh = W.map((row) => row.slice(c0, c1))
    return matmul(X, Wsh) // each shard's column block
  })
  // concat blocks along columns
  return X.map((_, i) => blocks.flatMap((b) => b[i]))
}

/** Row-parallel: shard s computes X[:, k_s] · W[k_s, :] (partial); all-reduce (sum). */
export function rowParallel(X: Matrix, W: Matrix, shards: number): Matrix {
  const m = X.length, n = W[0].length, k = X[0].length
  const partials = splitRanges(k, shards).map(([p0, p1]) => {
    const Xsh = X.map((row) => row.slice(p0, p1))
    const Wsh = W.slice(p0, p1)
    return matmul(Xsh, Wsh)
  })
  const Y: Matrix = Array.from({ length: m }, () => new Array(n).fill(0))
  for (const part of partials) for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) Y[i][j] += part[i][j]
  return Y
}

export function maxAbsDiff(A: Matrix, B: Matrix): number {
  let d = 0
  for (let i = 0; i < A.length; i++) for (let j = 0; j < A[0].length; j++) d = Math.max(d, Math.abs(A[i][j] - B[i][j]))
  return d
}
