import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { api } from "./api.js";
import { mcp } from "./mcp.js";

const app = new Hono();

app.route("/", api);
app.route("/api/mcp", mcp);

app.get("/", (c) =>
  c.json({
    name: "tasks-mcp-demo",
    openapi: "/api/openapi",
    mcp: "/api/mcp",
    note: "All API and MCP requests require `Authorization: Bearer demo-token`.",
  }),
);

const port = Number(process.env.PORT ?? 3333);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[server] listening on http://localhost:${info.port}`);
  console.log(`[server] OpenAPI doc: http://localhost:${info.port}/api/openapi`);
  console.log(`[server] MCP endpoint: http://localhost:${info.port}/api/mcp`);
  console.log(`[server] token: demo-token`);
});
