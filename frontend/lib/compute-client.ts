"use client"

// "Join the mesh" client compute (PLAN.md §9). Tries a WGSL compute shader on
// WebGPU (the showcase, with a live per-dispatch GPU time); feature-detects and
// falls back to the CPU Web Worker everywhere WebGPU isn't available. The byte
// mapping is done on the CPU in both paths so results match the server's
// deterministic self-check (only the f32 escape count can differ, absorbed by
// the verify tolerance).

import { tileGeometry, type JobRenderParams } from "./fractal"

export interface Computer {
  mode: "webgpu" | "cpu"
  compute(params: JobRenderParams, index: number): Promise<{ b64: string; gpuMs: number }>
  dispose(): void
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  return btoa(bin)
}

function mapIterToByte(it: number, maxIter: number): number {
  return it >= maxIter ? 0 : (1 + ((it * 254) / maxIter) | 0)
}

const WGSL = `
struct Params { cx0: f32, cy0: f32, dx: f32, dy: f32, tilePx: u32, maxIter: u32 };
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> outp: array<u32>;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= P.tilePx || gid.y >= P.tilePx) { return; }
  let cre = P.cx0 + P.dx * f32(gid.x);
  let cim = P.cy0 + P.dy * f32(gid.y);
  var zr = 0.0; var zi = 0.0; var i = 0u;
  loop {
    if (i >= P.maxIter) { break; }
    let zr2 = zr * zr; let zi2 = zi * zi;
    if (zr2 + zi2 > 4.0) { break; }
    zi = 2.0 * zr * zi + cim;
    zr = zr2 - zi2 + cre;
    i = i + 1u;
  }
  outp[gid.y * P.tilePx + gid.x] = i;
}`

async function createWebGPU(): Promise<Computer | null> {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu
  if (!gpu) return null
  try {
    const adapter = await gpu.requestAdapter()
    if (!adapter) return null
    const device = await adapter.requestDevice()
    const module = device.createShaderModule({ code: WGSL })
    const pipeline = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "main" } })

    return {
      mode: "webgpu",
      async compute(params, index) {
        const tp = params.tilePx
        const n = tp * tp
        const g = tileGeometry(params, index)
        const dx = (g.cx1 - g.cx0) / tp
        const dy = (g.cy1 - g.cy0) / tp

        const uni = new ArrayBuffer(24)
        const dv = new DataView(uni)
        dv.setFloat32(0, g.cx0, true)
        dv.setFloat32(4, g.cy0, true)
        dv.setFloat32(8, dx, true)
        dv.setFloat32(12, dy, true)
        dv.setUint32(16, tp, true)
        dv.setUint32(20, params.maxIter, true)

        const uniBuf = device.createBuffer({ size: 24, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
        device.queue.writeBuffer(uniBuf, 0, uni)
        const outBuf = device.createBuffer({ size: n * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC })
        const readBuf = device.createBuffer({ size: n * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ })

        const bind = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniBuf } },
            { binding: 1, resource: { buffer: outBuf } },
          ],
        })
        const t0 = performance.now()
        const enc = device.createCommandEncoder()
        const pass = enc.beginComputePass()
        pass.setPipeline(pipeline)
        pass.setBindGroup(0, bind)
        const groups = Math.ceil(tp / 8)
        pass.dispatchWorkgroups(groups, groups)
        pass.end()
        enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, n * 4)
        device.queue.submit([enc.finish()])
        await device.queue.onSubmittedWorkDone()
        const gpuMs = Math.round((performance.now() - t0) * 10) / 10

        await readBuf.mapAsync(GPUMapMode.READ)
        const iters = new Uint32Array(readBuf.getMappedRange().slice(0))
        readBuf.unmap()
        uniBuf.destroy()
        outBuf.destroy()
        readBuf.destroy()

        const bytes = new Uint8Array(n)
        for (let i = 0; i < n; i++) bytes[i] = mapIterToByte(iters[i], params.maxIter)
        return { b64: bytesToB64(bytes), gpuMs }
      },
      dispose() {
        device.destroy?.()
      },
    }
  } catch {
    return null
  }
}

function createCPU(): Computer {
  const worker = new Worker("/fractal-worker.js")
  let seq = 0
  const pending = new Map<number, (v: { b64: string; gpuMs: number }) => void>()
  worker.onmessage = (e: MessageEvent) => {
    const { requestId, b64, gpuMs } = e.data
    pending.get(requestId)?.({ b64, gpuMs })
    pending.delete(requestId)
  }
  return {
    mode: "cpu",
    compute(params, index) {
      const requestId = ++seq
      return new Promise((resolve) => {
        pending.set(requestId, resolve)
        worker.postMessage({ requestId, params, index })
      })
    },
    dispose() {
      worker.terminate()
    },
  }
}

/** Create the best available computer (WebGPU preferred, CPU fallback). */
export async function createComputer(preferGpu = true): Promise<Computer> {
  if (preferGpu) {
    const gpu = await createWebGPU()
    if (gpu) return gpu
  }
  return createCPU()
}
