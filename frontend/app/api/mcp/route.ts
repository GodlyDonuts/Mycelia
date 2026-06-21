import { NextResponse } from "next/server"
import { TOOLS, callTool } from "@/lib/mcp-tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Read-only MCP server over Streamable HTTP (JSON-RPC 2.0), PLAN.md §3.
// Methods: initialize, tools/list, tools/call, ping. The mesh stays
// server-authoritative — no mutating tools, /settle is not exposed.

const PROTOCOL_VERSION = "2024-11-05"
const SERVER_INFO = { name: "mycelia-mesh", version: "0.1.0" }

type RpcReq = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> }

function result(id: RpcReq["id"], res: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result: res })
}
function rpcError(id: RpcReq["id"], code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } })
}

export async function POST(req: Request) {
  let body: RpcReq
  try {
    body = await req.json()
  } catch {
    return rpcError(null, -32700, "parse error")
  }
  const { id, method, params } = body

  switch (method) {
    case "initialize":
      return result(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO })
    case "notifications/initialized":
      return new NextResponse(null, { status: 202 })
    case "ping":
      return result(id, {})
    case "tools/list":
      return result(id, { tools: TOOLS })
    case "tools/call": {
      const name = params?.name as string
      const args = (params?.arguments as Record<string, unknown>) ?? {}
      try {
        const text = await callTool(name, args)
        return result(id, { content: [{ type: "text", text }] })
      } catch (err) {
        return result(id, { content: [{ type: "text", text: err instanceof Error ? err.message : "tool error" }], isError: true })
      }
    }
    default:
      return rpcError(id, -32601, `method not found: ${method}`)
  }
}

// Lightweight discovery for humans hitting the endpoint in a browser.
export async function GET() {
  return NextResponse.json({
    server: SERVER_INFO,
    protocol: PROTOCOL_VERSION,
    transport: "streamable-http (json-rpc 2.0 over POST)",
    tools: TOOLS.map((t) => t.name),
    note: "Read-only. POST JSON-RPC: initialize | tools/list | tools/call | ping.",
  })
}
