# MCP Server Demo

A tiny, runnable version of the pattern from the blog post [An MCP Server That Writes Itself](https://pulkitxm.com/blogs/mcp-server-that-writes-itself).

Instead of hand-maintaining a second catalogue of "tools", we:

1. Describe a small REST API in [Hono](https://hono.dev) with [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi). The same Zod types serve the API, validate input, and generate an OpenAPI document.
2. Read that OpenAPI document and turn each allowed route into an MCP tool.
3. Expose tools, resources, and prompts over a minimal JSON-RPC endpoint at `/api/mcp`.

When you add a new route to the API, it shows up as a new tool the next time a client calls `tools/list`. No MCP code to touch.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is a shared plug shape for AI tools. Hosts like Claude Desktop, Cursor, and VS Code speak it, and one server can serve all of them.

It exposes three primitives:

- **Tools** - functions the model can call on its own.
- **Resources** - read-only data the host can pin into context.
- **Prompts** - slash-style shortcuts that seed a workflow.

This demo ships a handful of each.

## Layout

```
mcp-server/
├── src/
│   ├── api.ts                 Hono + zod-openapi app (the REST API)
│   ├── openapi-to-tools.ts    Convert the OpenAPI spec into MCP tools
│   ├── mcp.ts                 Minimal JSON-RPC handler (initialize / tools / resources / prompts)
│   ├── server.ts              HTTP entry point
│   └── demo.ts                Client that exercises the server end-to-end
├── package.json
└── README.md
```

## Quick start

```bash
cd mcp-server
pnpm install

# terminal 1 - start the server
pnpm server

# terminal 2 - run the walkthrough
pnpm demo
```

The walkthrough does the following:

1. `initialize` the MCP session.
2. `tools/list` - prints every tool generated from the OpenAPI spec.
3. `resources/list` - prints the single resource (`demo://openapi`).
4. `prompts/list` - prints the one example prompt (`triage_tasks`).
5. `tools/call listTasks { done: "false" }` - calls the wrapped REST endpoint.
6. `tools/call createTask { body: { title: "..." } }` - creates a task through MCP.
7. `tools/call completeTask { id: "t_2" }` then `getTask { id: "t_2" }`.

## The wrapped API

```
GET    /api/tasks                   listTasks      → tool: listTasks
GET    /api/tasks/{id}              getTask        → tool: getTask
POST   /api/tasks                   createTask     → tool: createTask
POST   /api/tasks/{id}/complete     completeTask   → tool: completeTask
POST   /api/admin/reset             adminReset     → BLOCKED (see deny list)
```

Every request (API or MCP) must carry `Authorization: Bearer demo-token`. The MCP layer reuses that same token for the Hono call, so permissions stay aligned with the user's key.

## The deny list

`src/openapi-to-tools.ts` drops any route matching:

- Path prefix: `/api/auth`, `/api/webhooks`, `/api/admin`, `/api/mcp`
- Path substring: `/api-keys`, `/credentials`
- Operation id substring: `apiKey`, `credential`, `admin`

The `adminReset` operation matches the last rule, so it never appears in `tools/list`. The model cannot call it.

## Try it manually

Every call is plain JSON over HTTP. No SDK needed, the inspector works, `curl` works.

```bash
curl -s http://localhost:3333/api/mcp \
  -H "content-type: application/json" \
  -H "authorization: Bearer demo-token" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | jq

curl -s http://localhost:3333/api/mcp \
  -H "content-type: application/json" \
  -H "authorization: Bearer demo-token" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | jq

curl -s http://localhost:3333/api/mcp \
  -H "content-type: application/json" \
  -H "authorization: Bearer demo-token" \
  -d '{
    "jsonrpc":"2.0","id":3,"method":"tools/call",
    "params":{"name":"createTask","arguments":{"body":{"title":"ship it"}}}
  }' | jq
```

## Wire it into Cursor

Drop this into `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "tasks-demo": {
      "url": "http://localhost:3333/api/mcp",
      "headers": { "Authorization": "Bearer demo-token" }
    }
  }
}
```

Restart Cursor and the tools show up in the MCP panel.

## What this skips on purpose

- **Streaming (SSE)**. Plain JSON only, matching the `disableSse: true` path from the blog.
- **Session management**. Each POST is handled statelessly.
- **OAuth**. One hard-coded bearer token. Swap in a real auth check (API keys, PATs, sessions) when you port this.
- **Full JSON Schema → Zod conversion**. The OpenAPI-to-tools layer copies JSON Schema through as-is; hosts handle validation.
- **Response truncation for huge payloads** is there, sized at 200KB, but the demo's bodies are small so you rarely see it kick in.

The goal is to fit the whole MCP front-door in ~400 lines of TypeScript you can read top to bottom.

## Related

- Blog post: [An MCP Server That Writes Itself](https://pulkitxm.com/blogs/mcp-server-that-writes-itself)
- [Model Context Protocol spec](https://modelcontextprotocol.io)
- [Hono](https://hono.dev) and [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)
