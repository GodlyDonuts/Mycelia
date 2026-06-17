import { Button } from "@/components/ui/button"
import { MyceliumBackground } from "@/components/mycelium-background"
import { ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      {/* delicate ambient web */}
      <MyceliumBackground className="absolute inset-0 h-full w-full opacity-80" />
      {/* keep the type legible without a heavy vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,var(--background)_95%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto w-full max-w-4xl px-6 py-32 text-center lg:px-8">
        <h1 className="font-display mx-auto max-w-3xl text-[2.6rem] font-normal leading-[1.04] text-foreground sm:text-6xl lg:text-[4.1rem]">
          Idle machines, woven into one{" "}
          <span className="italic text-foreground/85">living</span> compute cloud.
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          The AI boom is starving the planet of compute, and new datacenters take
          years to build. Mycelia grows one instead — weaving the GPUs and CPUs
          already sitting idle in millions of machines into a single, living network.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            className="group h-11 w-full gap-2 bg-primary px-6 font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            Become a Cultivator
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="h-11 w-full gap-2 px-5 text-foreground hover:bg-secondary sm:w-auto"
          >
            Submit a job
            <ArrowRight className="size-4 text-muted-foreground" />
          </Button>
        </div>

        <p className="mt-8 font-mono text-xs text-tertiary">
          No new silicon. No new datacenters. Just the machines we already have.
        </p>
      </div>
    </section>
  )
}
