#!/usr/bin/env node
/**
 * Native P2P relay peer for pipeline activation forwarding (roadmap).
 * Runs alongside mycelia-daemon when direct WebRTC ICE fails.
 *
 *   node daemon/p2p-relay.mjs --region us-east-1 --port 3478
 */

import { createServer } from "node:http"

const args = process.argv.slice(2)
const region = args.includes("--region") ? args[args.indexOf("--region") + 1] : "us-east-1"
const port = args.includes("--port") ? Number(args[args.indexOf("--port") + 1]) : 8787

const sessions = new Map()
let bytesRelayed = 0

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ region, sessions: sessions.size, bytesRelayed, status: "ok" }))
    return
  }
  if (req.url === "/relay/stats") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(
      JSON.stringify({
        region,
        activeSessions: sessions.size,
        bytesRelayed,
        turnCompatible: true,
        note: "Stub relay — production uses coturn on Fargate",
      }),
    )
    return
  }
  res.writeHead(404)
  res.end("not found")
})

server.listen(port, () => {
  console.log(`[mycelia-relay] region=${region} listening on :${port}`)
})
