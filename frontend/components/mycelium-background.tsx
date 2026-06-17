"use client"

import { useEffect, useRef } from "react"

type Node = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  phase: number
  lit: boolean
}

/**
 * MyceliumBackground
 * A delicate, mostly-neutral drifting node-link web — thin hairline threads with
 * a handful of softly-lit jade nodes. Restraint over glow. Respects reduced-motion.
 */
export function MyceliumBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let width = 0
    let height = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let nodes: Node[] = []
    let raf = 0

    const LINK_DIST = 150
    const JADE = "111, 211, 184"
    const THREAD = "236, 235, 228" // faint warm-white threads

    function build() {
      const parent = canvas.parentElement
      width = parent?.clientWidth ?? window.innerWidth
      height = parent?.clientHeight ?? window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // sparse density — a quiet web, not a swarm
      const count = Math.min(Math.round((width * height) / 34000), 46)
      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        r: 0.7 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        // only ~1 in 7 nodes is "lit" jade; the rest are neutral
        lit: i % 7 === 0,
      }))
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, width, height)

      // threads
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.07
            ctx.strokeStyle = `rgba(${THREAD}, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      // nodes
      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.0009 + n.phase)
        if (n.lit) {
          ctx.fillStyle = `rgba(${JADE}, ${0.35 + pulse * 0.4})`
        } else {
          ctx.fillStyle = `rgba(${THREAD}, ${0.1 + pulse * 0.12})`
        }
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r + (n.lit ? pulse * 0.5 : 0), 0, Math.PI * 2)
        ctx.fill()

        if (!reduced) {
          n.x += n.vx
          n.y += n.vy
          if (n.x < -20) n.x = width + 20
          if (n.x > width + 20) n.x = -20
          if (n.y < -20) n.y = height + 20
          if (n.y > height + 20) n.y = -20
        }
      }

      raf = requestAnimationFrame(draw)
    }

    build()
    if (reduced) {
      draw(0)
    } else {
      raf = requestAnimationFrame(draw)
    }

    const onResize = () => build()
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />
}
