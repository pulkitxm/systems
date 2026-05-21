import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

type Task = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

const tasks = new Map<string, Task>();

function seed() {
  tasks.clear();
  const now = new Date().toISOString();
  tasks.set("t_1", { id: "t_1", title: "write the blog post", done: true, createdAt: now });
  tasks.set("t_2", { id: "t_2", title: "ship the MCP server", done: false, createdAt: now });
  tasks.set("t_3", { id: "t_3", title: "go for a run", done: false, createdAt: now });
}
seed();

const TaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    done: z.boolean(),
    createdAt: z.string(),
  })
  .openapi("Task");

const ErrorSchema = z.object({ error: z.string() }).openapi("Error");

export const api = new OpenAPIHono();

api.use("*", async (c, next) => {
  if (c.req.path === "/api/openapi" || c.req.path === "/api/doc") {
    return next();
  }
  const auth = c.req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (token !== "demo-token") {
    return c.json({ error: "unauthorized" }, 401);
  }
  return next();
});

api.openapi(
  createRoute({
    method: "get",
    path: "/api/tasks",
    operationId: "listTasks",
    summary: "List all tasks",
    description: "Return every task in the in-memory store, newest first.",
    request: {
      query: z.object({
        done: z
          .enum(["true", "false"])
          .optional()
          .openapi({ description: "Filter by completion state." }),
      }),
    },
    responses: {
      200: {
        description: "Tasks",
        content: { "application/json": { schema: z.object({ tasks: z.array(TaskSchema) }) } },
      },
    },
  }),
  (c) => {
    const { done } = c.req.valid("query");
    let list = Array.from(tasks.values());
    if (done === "true") list = list.filter((t) => t.done);
    if (done === "false") list = list.filter((t) => !t.done);
    return c.json({ tasks: list });
  },
);

api.openapi(
  createRoute({
    method: "get",
    path: "/api/tasks/{id}",
    operationId: "getTask",
    summary: "Get one task by id",
    description: "Fetch a single task. Returns 404 if the task does not exist.",
    request: {
      params: z.object({ id: z.string().openapi({ description: "Task id, e.g. t_1" }) }),
    },
    responses: {
      200: { description: "Task", content: { "application/json": { schema: TaskSchema } } },
      404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    },
  }),
  (c) => {
    const { id } = c.req.valid("param");
    const task = tasks.get(id);
    if (!task) return c.json({ error: `task ${id} not found` }, 404);
    return c.json(task, 200);
  },
);

api.openapi(
  createRoute({
    method: "post",
    path: "/api/tasks",
    operationId: "createTask",
    summary: "Create a new task",
    description: "Add a task to the store and return the created record.",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              title: z.string().min(1).openapi({ description: "What needs doing." }),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: "Created", content: { "application/json": { schema: TaskSchema } } },
    },
  }),
  (c) => {
    const { title } = c.req.valid("json");
    const id = `t_${tasks.size + 1}`;
    const task: Task = { id, title, done: false, createdAt: new Date().toISOString() };
    tasks.set(id, task);
    return c.json(task, 201);
  },
);

api.openapi(
  createRoute({
    method: "post",
    path: "/api/tasks/{id}/complete",
    operationId: "completeTask",
    summary: "Mark a task as done",
    description: "Flip the done flag on an existing task and return the updated record.",
    request: {
      params: z.object({ id: z.string().openapi({ description: "Task id to complete." }) }),
    },
    responses: {
      200: { description: "Updated", content: { "application/json": { schema: TaskSchema } } },
      404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    },
  }),
  (c) => {
    const { id } = c.req.valid("param");
    const task = tasks.get(id);
    if (!task) return c.json({ error: `task ${id} not found` }, 404);
    task.done = true;
    return c.json(task, 200);
  },
);

api.openapi(
  createRoute({
    method: "post",
    path: "/api/admin/reset",
    operationId: "adminReset",
    summary: "Wipe and reseed the task store",
    description: "Destructive. Meant for humans, not for agents.",
    responses: {
      200: {
        description: "Reset",
        content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
      },
    },
  }),
  (c) => {
    seed();
    return c.json({ ok: true });
  },
);

api.doc("/api/openapi", {
  openapi: "3.0.0",
  info: { title: "Tasks API", version: "1.0.0" },
});
