import { getNetwork } from "@/lib/reads"
import { startDriver } from "@/lib/driver"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Server-Sent Events carrying the live network frame (PLAN §3 "SSE on Fluid
// Compute … the explicit carrier of the 1s active-render beat"). On Vercel this
// is a Fluid function; locally it's a streaming Node route. Clients fall back to
// polling /api/network if EventSource is unavailable.
export async function GET(req: Request) {
  startDriver()
  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const frame = await getNetwork()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`))
        } catch {
          /* skip a frame on transient error */
        }
      }
      await send()
      timer = setInterval(send, 1500)
      req.signal.addEventListener("abort", () => {
        if (timer) clearInterval(timer)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      })
    },
    cancel() {
      if (timer) clearInterval(timer)
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  })
}
