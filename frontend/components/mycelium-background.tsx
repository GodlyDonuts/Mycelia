"use client"

import { useEffect, useRef } from "react"

type Node = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  phase: number
}

/**
 * MyceliumBackground
 * GPU-light canvas animation: a slowly drifting glowing teal node-link web
 * on the dark charcoal background. Respects prefers-reduced-motion.
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

    const LINK_DIST = 170
    const TEAL = "46, 230, 197"

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

      // density scales with area, capped for performance
      const count = Math.min(Math.round((width * height) / 22000), 70)
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 0.8 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, width, height)

      // links
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.16
            ctx.strokeStyle = `rgba(${TEAL}, ${alpha})`
            ctx.lineWidth = 0.6
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      // nodes (soft glowing spores)
      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.0011 + n.phase)
        const glow = 0.25 + pulse * 0.45
        ctx.beginPath()
        ctx.fillStyle = `rgba(${TEAL}, ${glow})`
        ctx.shadowBlur = 8
        ctx.shadowColor = `rgba(${TEAL}, ${glow})`
        ctx.arc(n.x, n.y, n.r + pulse * 0.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

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

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
    />
  )
}
