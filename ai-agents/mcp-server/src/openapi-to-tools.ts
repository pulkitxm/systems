import { createHash } from "node:crypto";

export type AppLike = {
  request: (input: string, init?: RequestInit) => Response | Promise<Response>;
};

const MCP_TOOL_NAME_MAX_LEN = 48;

const DENY_PATH_PREFIXES = ["/api/auth", "/api/webhooks", "/api/admin", "/api/mcp"] as const;
const DENY_PATH_SUBSTRINGS = ["/api-keys", "/credentials"] as const;
const DENY_OPERATION_ID_SUBSTRINGS = ["apiKey", "credential", "admin"] as const;

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: unknown[];
  description?: string;
  $ref?: string;
};

type Parameter = {
  name: string;
  in: "path" | "query" | "header";
  required?: boolean;
  schema?: JsonSchema;
  description?: string;
};

type Operation = {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: {
    required?: boolean;
    content?: { "application/json"?: { schema?: JsonSchema } };
  };
};

export type OpenApiDoc = {
  paths?: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, JsonSchema> };
};

export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  method: string;
  path: string;
};

export async function loadOpenApi(app: AppLike, docPath = "/api/openapi"): Promise<OpenApiDoc> {
  const res = await app.request(`http://internal${docPath}`);
  if (!res.ok) throw new Error(`openapi fetch failed: ${res.status}`);
  return (await res.json()) as OpenApiDoc;
}

function isDenied(path: string, op: Operation): boolean {
  if (DENY_PATH_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (DENY_PATH_SUBSTRINGS.some((s) => path.includes(s))) return true;
  const id = op.operationId ?? "";
  if (DENY_OPERATION_ID_SUBSTRINGS.some((s) => id.includes(s))) return true;
  return false;
}

function slugify(s: string): string {
  return s
    .replace(/[{}]/g, "")
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/^_+/, "");
}

function shortenToMcpToolLimit(name: string): string {
  if (name.length <= MCP_TOOL_NAME_MAX_LEN) return name;
  const hash = createHash("sha256").update(name).digest("hex").slice(0, 6);
  const suffix = `_${hash}`;
  return name.slice(0, MCP_TOOL_NAME_MAX_LEN - suffix.length) + suffix;
}

function resolveRef(spec: OpenApiDoc, schema: JsonSchema | undefined): JsonSchema {
  if (!schema) return { type: "object" };
  if (!schema.$ref) return schema;
  const match = /#\/components\/schemas\/(.+)$/.exec(schema.$ref);
  if (!match) return { type: "object" };
  return spec.components?.schemas?.[match[1]!] ?? { type: "object" };
}

function buildInputSchema(spec: OpenApiDoc, op: Operation): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const param of op.parameters ?? []) {
    if (param.in !== "path" && param.in !== "query") continue;
    properties[param.name] = {
      ...(param.schema ?? { type: "string" }),
      description: param.description ?? `${param.in} parameter ${param.name}`,
    };
    if (param.required) required.push(param.name);
  }

  const bodySchema = op.requestBody?.content?.["application/json"]?.schema;
  if (bodySchema) {
    properties.body = {
      ...resolveRef(spec, bodySchema),
      description: "JSON request body.",
    };
    if (op.requestBody?.required) required.push("body");
  }

  return { type: "object", properties, required };
}

function buildDescription(op: Operation, path: string, method: string): string {
  const lines: string[] = [];
  if (op.description) lines.push(op.description);
  else if (op.summary) lines.push(op.summary);
  lines.push("", `Calls \`${method.toUpperCase()} ${path}\` on the wrapped API.`);

  const params = (op.parameters ?? []).filter((p) => p.in === "path" || p.in === "query");
  if (params.length) {
    lines.push("", "Parameters:");
    for (const p of params) {
      const tag = p.required ? "required" : "optional";
      lines.push(`- \`${p.name}\` (${p.in}, ${tag}): ${p.description ?? "no description"}`);
    }
  }
  if (op.requestBody) {
    lines.push("", "Body: JSON object under the `body` key.");
  }
  return lines.join("\n");
}

export async function generateTools(app: AppLike): Promise<McpTool[]> {
  const spec = await loadOpenApi(app);
  const tools: McpTool[] = [];
  const used = new Set<string>();

  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      if (isDenied(path, op)) continue;

      const raw = op.operationId ? slugify(op.operationId) : slugify(`${method}_${path}`);
      let name = shortenToMcpToolLimit(raw);
      let counter = 1;
      while (used.has(name)) {
        name = shortenToMcpToolLimit(`${raw}_${counter++}`);
      }
      used.add(name);

      tools.push({
        name,
        title: op.summary ?? name,
        description: buildDescription(op, path, method),
        inputSchema: buildInputSchema(spec, op),
        method: method.toUpperCase(),
        path,
      });
    }
  }

  return tools;
}

export function buildRequest(
  tool: McpTool,
  args: Record<string, unknown>,
): { url: string; method: string; body?: string } {
  let url = tool.path;
  const query: string[] = [];

  for (const [key, value] of Object.entries(args)) {
    if (key === "body") continue;
    if (url.includes(`{${key}}`)) {
      url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
    } else if (value !== undefined && value !== null) {
      query.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  if (query.length) url += `?${query.join("&")}`;
  const body = args.body !== undefined ? JSON.stringify(args.body) : undefined;
  return { url, method: tool.method, body };
}
