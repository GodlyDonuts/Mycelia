"use client"

import { useEffect, useRef, useState } from "react"

/**
 * useCountUp
 * Animates from 0 → `end` once the element scrolls into view.
 * Returns a ref to attach and the current animated value.
 */
export function useCountUp(end: number, duration = 1600) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const run = () => {
      if (started.current) return
      started.current = true
      if (reduced) {
        setValue(end)
        return
      }
      const start = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1)
        // easeOutExpo
        const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
        setValue(end * eased)
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => e.isIntersecting && run())
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration])

  return { ref, value }
}
