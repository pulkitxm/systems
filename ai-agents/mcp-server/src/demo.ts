const ENDPOINT = process.env.MCP_URL ?? "http://localhost:3333/api/mcp";
const TOKEN = process.env.MCP_TOKEN ?? "demo-token";

let id = 0;

async function rpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const body = { jsonrpc: "2.0", id: ++id, method, params };
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok && res.status !== 202) {
    throw new Error(`rpc ${method} failed: ${res.status} ${await res.text()}`);
  }

  if (res.status === 202) return null;
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`rpc ${method} error: ${json.error.message}`);
  return json.result;
}

function banner(text: string) {
  const bar = "-".repeat(text.length + 4);
  console.log(`\n${bar}\n  ${text}\n${bar}`);
}

async function initialize() {
  banner("initialize");
  const result = (await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "demo-client", version: "1.0.0" },
  })) as { serverInfo: { name: string; version: string }; instructions?: string };
  console.log(`server: ${result.serverInfo.name} v${result.serverInfo.version}`);
  if (result.instructions) console.log(`instructions: ${result.instructions}`);
  await rpc("notifications/initialized");
}

async function listTools() {
  banner("tools/list");
  const result = (await rpc("tools/list")) as {
    tools: { name: string; title: string; description: string }[];
  };
  for (const tool of result.tools) {
    console.log(`- ${tool.name}  (${tool.title})`);
  }
  console.log(`\n${result.tools.length} tools generated from OpenAPI.`);
  return result.tools;
}

async function listResources() {
  banner("resources/list");
  const result = (await rpc("resources/list")) as {
    resources: { uri: string; name: string; description: string }[];
  };
  for (const r of result.resources) {
    console.log(`- ${r.uri}  :: ${r.name}`);
    console.log(`    ${r.description}`);
  }
}

async function listPrompts() {
  banner("prompts/list");
  const result = (await rpc("prompts/list")) as {
    prompts: { name: string; description: string }[];
  };
  for (const p of result.prompts) {
    console.log(`- /${p.name}  :: ${p.description}`);
  }
}

async function callTool(name: string, args: Record<string, unknown>) {
  banner(`tools/call  ${name}`);
  console.log(`arguments: ${JSON.stringify(args)}`);
  const result = (await rpc("tools/call", { name, arguments: args })) as {
    isError: boolean;
    content: { type: string; text: string }[];
  };
  console.log(`isError: ${result.isError}`);
  console.log(result.content[0]?.text);
}

async function walkthrough() {
  await initialize();
  await listTools();
  await listResources();
  await listPrompts();

  await callTool("listTasks", { done: "false" });
  await callTool("createTask", { body: { title: "try the MCP demo" } });
  await callTool("completeTask", { id: "t_2" });
  await callTool("getTask", { id: "t_2" });
}

const [, , cmd, ...args] = process.argv;

if (cmd === "list") {
  initialize()
    .then(listTools)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else if (cmd === "call") {
  const [toolName, argsJson] = args;
  if (!toolName) {
    console.error("usage: pnpm call-tool <name> '<json-args>'");
    process.exit(1);
  }
  const parsed = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  initialize()
    .then(() => callTool(toolName, parsed))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  walkthrough().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
