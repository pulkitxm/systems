# Cron Jobs with BullMQ

A TypeScript implementation demonstrating production-grade cron job scheduling with BullMQ and Redis.

## 📚 Key Concepts

### How BullMQ Cron Works

BullMQ doesn't run a scheduler daemon. It uses **repeatable jobs**, which are delayed jobs that re-add themselves:

1. You register a job with a cron pattern via `queue.add(..., { repeat: { pattern } })`
2. BullMQ stores the repeatable config in Redis and schedules the first delayed job
3. When a worker picks up the job, BullMQ automatically schedules the next occurrence
4. The chain is self-sustaining as long as workers are processing

### Why BullMQ Over Raw Redis / node-cron

| Feature | node-cron / setInterval | Raw Redis | BullMQ |
|---|---|---|---|
| Persistence | None (in-process) | Manual | Built-in |
| Retries & backoff | Manual | Manual | Configurable |
| Concurrency control | None | Manual | Built-in |
| Stalled job detection | None | Manual | Built-in |
| Deduplication | None | Manual | Automatic |
| Graceful shutdown | Manual | Manual | Built-in |
| Dynamic schedules | Code-time only | Yes | Yes (runtime API) |

BullMQ is a layer of battle-tested Lua scripts over Redis. You could build it yourself, but you'd be reimplementing the job lifecycle state machine (delayed → waiting → active → completed/failed), locking, and stalled job recovery.

## 🏗️ Architecture

```
Add Schedule (CLI / API)
    ↓
    └─→ Redis (BullMQ Queue: "cron-jobs")
            │
            ├─→ Repeatable job configs (cron patterns)
            ├─→ Delayed jobs (next scheduled run)
            └─→ Active/completed/failed jobs
                    ↓
              Worker Process
              (picks up jobs, executes tasks,
               BullMQ auto-schedules the next run)
```

## 🚀 How to Run

### 1. Start Redis

```bash
docker-compose up -d
```

**Redis Commander UI**: http://localhost:8081

### 2. Install Dependencies

```bash
pnpm install
# or
npm install
```

### 3. Register Cron Schedules

```bash
pnpm run add-schedule
```

This registers 4 sample schedules:
- `daily-report` — every 1 minute (demo)
- `cleanup` — every 2 minutes
- `health-check` — every 1 minute
- `send-digest` — every 3 minutes

### 4. Start the Worker

```bash
pnpm run worker
```

Watch jobs execute on schedule. The worker processes up to 3 jobs concurrently.

### 5. Inspect & Manage

**List all active schedules:**
```bash
pnpm run list-schedules
```

**Remove a schedule:**
```bash
pnpm run remove-schedule "<repeat-job-key>"
```

**Sync from mock database:**
```bash
pnpm run sync-schedules
```

## 🔍 What to Observe

### In the Terminal
1. **Repeatable execution**: Jobs fire on their cron schedule without any in-process timer
2. **Retry on failure**: The `health-check` task randomly fails ~20% of the time — watch BullMQ retry it with exponential backoff
3. **Concurrency**: Multiple jobs can process simultaneously (concurrency: 3)
4. **Graceful shutdown**: Press Ctrl+C — the worker finishes active jobs before stopping

### In Redis Commander (http://localhost:8081)
1. Browse the `bull:cron-jobs:*` keys to see queue state
2. See repeatable job configs, delayed jobs, and completed/failed sets
3. Watch keys change as jobs are processed

## 🧪 Experiments to Try

### Experiment 1: Idempotent Registration
Run `add-schedule` twice:
```bash
pnpm run add-schedule
pnpm run add-schedule
```
**Observe**: No duplicate schedules. BullMQ deduplicates by job name + cron pattern + jobId.

### Experiment 2: Worker Failure & Recovery
1. Start the worker
2. Wait for a few jobs to process
3. Kill the worker (Ctrl+C)
4. Wait a minute
5. Restart the worker
**Observe**: Jobs don't accumulate. The worker picks up from the next scheduled time, not a backlog.

### Experiment 3: Schedule Reconciliation
1. Run `add-schedule` to register the original 4 schedules
2. Run `sync-schedules` — the mock database has:
   - `cleanup` changed from every 2 min to every 5 min
   - `send-digest` disabled
3. **Observe**: Sync updates the changed schedule, removes the disabled one, leaves the rest unchanged.

### Experiment 4: Remove a Schedule
1. Run `list-schedules` to see all active schedules and their keys
2. Copy a key and run `remove-schedule "<key>"`
3. Run `list-schedules` again
**Observe**: The schedule is gone. No more jobs will fire for it.

## 📁 File Structure

```
src/
├── connection.ts      # Redis connection config
├── queue.ts           # Queue setup, add/remove/list schedules
├── worker.ts          # Worker with task handlers, graceful shutdown
├── add-schedule.ts    # CLI: register sample cron schedules
├── list-schedules.ts  # CLI: list all active repeatable jobs
├── remove-schedule.ts # CLI: remove a schedule by key
└── sync-schedules.ts  # CLI: reconcile mock DB ↔ Redis
```

## 🛑 Cleanup

```bash
docker-compose down -v
```

## 📖 Key Takeaways

1. **No scheduler process**: BullMQ cron is just delayed jobs that chain — no daemon, no polling loop
2. **Redis is the source of truth**: Schedules survive app restarts because they live in Redis, not your process
3. **Idempotent registration**: Safe to call `queue.add()` with the same repeat options on every deploy
4. **Jobs don't pile up**: If workers are down, only the next occurrence waits — no backlog of missed runs
5. **Reconciliation matters**: Always have a script to sync your database (source of truth) with Redis (runtime state)

## Related

- Blog post: [Async Processing with Message Queues, Streams, and Pub/Sub](https://pulkitxm.com/series/system-design/async-processing)
