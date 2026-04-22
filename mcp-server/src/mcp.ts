import { Hono } from "hono";
import { buildRequest, generateTools, loadOpenApi, type McpTool } from "./openapi-to-tools.js";
import { api } from "./api.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "tasks-mcp-demo";
const SERVER_VERSION = "1.0.0";

const MAX_TOOL_RESPONSE_CHARS = 200_000;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: number | string | null; result: unknown }
  | { jsonrpc: "2.0"; id: number | string | null; error: { code: number; message: string } };

type AuthInfo = { token: string; userId: string };

function verifyToken(req: Request): AuthInfo | null {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== "demo-token") return null;
  return { token, userId: "demo-user" };
}

async function readResponsePreview(res: Response): Promise<{ payload: unknown; truncated: number }> {
  const text = await res.text();
  if (text.length <= MAX_TOOL_RESPONSE_CHARS) {
    try {
      return { payload: JSON.parse(text), truncated: 0 };
    } catch {
      return { payload: text, truncated: 0 };
    }
  }
  return {
    payload: text.slice(0, MAX_TOOL_RESPONSE_CHARS),
    truncated: text.length - MAX_TOOL_RESPONSE_CHARS,
  };
}

let toolsCache: McpTool[] | null = null;
async function getTools(): Promise<McpTool[]> {
  if (!toolsCache) toolsCache = await generateTools(api);
  return toolsCache;
}

async function handleRpc(msg: JsonRpcRequest, auth: AuthInfo): Promise<JsonRpcResponse | null> {
  const id = msg.id ?? null;

  try {
    switch (msg.method) {
      case "initialize": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
            capabilities: {
              tools: { listChanged: false },
              resources: { listChanged: false },
              prompts: { listChanged: false },
            },
            instructions:
              "Read the `demo://openapi` resource first if you need to discover routes. Use `listTasks` before calling `getTask` so you have real ids.",
          },
        };
      }

      case "notifications/initialized":
      case "notifications/cancelled":
        return null;

      case "tools/list": {
        const tools = await getTools();
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: tools.map((t) => ({
              name: t.name,
              title: t.title,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          },
        };
      }

      case "tools/call": {
        const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
        const tools = await getTools();
        const tool = tools.find((t) => t.name === params.name);
        if (!tool) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: `tool not found: ${params.name}` },
          };
        }

        const { url, method, body } = buildRequest(tool, params.arguments ?? {});
        const res = await api.request(`http://internal${url}`, {
          method,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${auth.token}`,
          },
          body,
        });

        const { payload, truncated } = await readResponsePreview(res);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            isError: !res.ok,
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { status: res.status, body: payload, truncatedChars: truncated },
                  null,
                  2,
                ),
              },
            ],
          },
        };
      }

      case "resources/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            resources: [
              {
                uri: "demo://openapi",
                name: "OpenAPI spec",
                title: "Raw OpenAPI description",
                description:
                  "The OpenAPI document the MCP server reads to generate its tool list. Useful when you want to see exact schemas.",
                mimeType: "application/json",
              },
            ],
          },
        };
      }

      case "resources/read": {
        const params = (msg.params ?? {}) as { uri?: string };
        if (params.uri !== "demo://openapi") {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: `unknown resource: ${params.uri}` },
          };
        }
        const spec = await loadOpenApi(api);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            contents: [
              { uri: "demo://openapi", mimeType: "application/json", text: JSON.stringify(spec) },
            ],
          },
        };
      }

      case "prompts/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            prompts: [
              {
                name: "triage_tasks",
                title: "Triage open tasks",
                description: "Walk through open tasks and suggest which to knock out first.",
                arguments: [],
              },
            ],
          },
        };
      }

      case "prompts/get": {
        const params = (msg.params ?? {}) as { name?: string };
        if (params.name !== "triage_tasks") {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: `unknown prompt: ${params.name}` },
          };
        }
        return {
          jsonrpc: "2.0",
          id,
          result: {
            description: "Triage open tasks",
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: [
                    "You are helping me triage my task list.",
                    "1. Call `listTasks` with done=false to see what is still open.",
                    "2. Group tasks by effort and suggest an order.",
                    "3. Only call `completeTask` when I explicitly confirm.",
                  ].join("\n"),
                },
              },
            ],
          },
        };
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `method not found: ${msg.method}` },
        };
    }
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
    };
  }
}

export const mcp = new Hono();

mcp.post("/", async (c) => {
  const auth = verifyToken(c.req.raw);
  if (!auth) return c.json({ error: "unauthorized" }, 401);

  let msg: JsonRpcRequest;
  try {
    msg = (await c.req.json()) as JsonRpcRequest;
  } catch {
    return c.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
  }

  const response = await handleRpc(msg, auth);
  if (response === null) return c.body(null, 202);
  return c.json(response);
});

mcp.get("/", (c) =>
  c.json({
    server: SERVER_NAME,
    version: SERVER_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    transport: "stateless-http",
  }),
);
