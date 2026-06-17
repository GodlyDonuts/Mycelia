"use client"

import { Button } from "@/components/ui/button"
import { MyceliumBackground } from "@/components/mycelium-background"
import { ArrowRight, Upload } from "lucide-react"

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      {/* Animated mycelium-thread background */}
      <MyceliumBackground className="absolute inset-0 h-full w-full opacity-70" />
      {/* depth vignette so text stays legible */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--background)_92%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto w-full max-w-5xl px-4 py-32 text-center sm:px-6 lg:px-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 backdrop-blur">
          <span className="size-1.5 rounded-full bg-status-online [animation:spore-pulse_2.4s_ease-in-out_infinite]" />
          <span className="font-mono text-xs tracking-wide text-muted-foreground">
            THE LIVING COMPUTE NETWORK
          </span>
        </div>

        <h1 className="mx-auto max-w-4xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Turn the world&apos;s idle machines into one{" "}
          <span className="text-primary text-glow">living compute cloud.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          The AI boom is starving the planet of compute, and new datacenters take
          years to build. Mycelia grows a network instead &mdash; weaving the GPUs
          and CPUs that already sit idle in millions of machines into one
          datacenter-class organism.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            className="group h-12 w-full gap-2 bg-primary px-6 text-primary-foreground hover:bg-primary/90 glow-teal sm:w-auto"
          >
            Become a Cultivator
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 w-full gap-2 border-border bg-card/40 px-6 text-foreground backdrop-blur hover:bg-card hover:text-foreground sm:w-auto"
          >
            <Upload className="size-4" />
            Submit a Job
          </Button>
        </div>

        <p className="mt-6 font-mono text-xs text-tertiary">
          No new silicon. No new datacenters. Just the machines we already have.
        </p>
      </div>
    </section>
  )
}
