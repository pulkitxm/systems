# Rate Limiter on Redis

TypeScript implementation of four popular rate-limiting algorithms on top of Redis, with atomic Lua scripts and runnable demos.

Exercise from Arpit Bhayani's *Designing API Rate Limiter* lecture: "read and implement leaky bucket, fixed window and sliding window algorithm using Redis".

## Algorithms


| Algorithm              | Memory                        | Accuracy    | Burst handling                     |
| ---------------------- | ----------------------------- | ----------- | ---------------------------------- |
| Fixed Window Counter   | 1 counter per window per user | approximate | allows 2× burst at window boundary |
| Sliding Window Log     | N timestamps per user         | exact       | no edge burst                      |
| Sliding Window Counter | 2 counters per user           | approximate | smooths edge burst                 |
| Leaky Bucket           | level + timestamp per user    | exact rate  | rejects overflow, constant outflow |


Every algorithm runs as a single Lua script inside Redis so the read–check–write is atomic.

## Setup

```bash
pnpm install
```

Start Redis:

```bash
docker-compose up -d
```

Redis Commander UI: [http://localhost:8081](http://localhost:8081)

## Demos

### Fixed Window

```bash
pnpm fixed-window
```

- 5 requests per 5-second window on one user
- Second run shows the **edge-burst problem**: 10 requests pass in ~1 second across a window boundary even though the limit is 5 per 5s.

### Sliding Window Log

```bash
pnpm sliding-log
```

- Tracks exact request timestamps in a Redis sorted set (`ZADD` + `ZREMRANGEBYSCORE`).
- Same limit, no edge burst possible. Rejected requests report exact retry time.

### Sliding Window Counter

```bash
pnpm sliding-counter
```

- Keeps two counters (current window + previous window).
- Weighted approximation: `estimated = previousCount * (1 - elapsed/window) + currentCount`
- Memory-efficient like fixed window, smoothing like sliding log.

### Leaky Bucket

```bash
pnpm leaky-bucket
```

- Bucket of capacity N, constant leak rate R req/sec.
- Stores `{ level, lastTimestamp }` per user in a Redis hash.
- On each request: leak based on elapsed time, then try to add one unit.
- Guarantees a steady outflow rate — great for downstream protection.

### Race Condition

```bash
pnpm race-condition
```

Fires 20 concurrent requests at limit=5:

- **Naive** `GET` → check → `INCR`: allows more than 5. The read and write are separate round-trips, so concurrent clients all read "0" before any of them increments.
- **Lua**: `EVAL` runs atomically inside Redis. Always exactly 5.

This is the reason every limiter in this repo is implemented as a Lua script.

### Compare All

```bash
pnpm all
```

Runs the same 8-request burst against every algorithm, then a steady 1 req/s cadence so you can see behavior differences side by side.

## File Structure

```
src/
├── connection.ts                    # ioredis client + RateLimitResult type
├── fixed-window.ts                  # Fixed window counter (Lua)
├── sliding-window-log.ts            # Sorted-set log of timestamps (Lua)
├── sliding-window-counter.ts        # Weighted previous+current counters (Lua)
├── leaky-bucket.ts                  # Level + timestamp, continuous leak (Lua)
├── utils.ts                         # sleep, header, fireRequests helpers
├── demo-fixed-window.ts
├── demo-sliding-window-log.ts
├── demo-sliding-window-counter.ts
├── demo-leaky-bucket.ts
├── demo-race-condition.ts
└── demo-all.ts
```

## Usage in Your Own Code

```ts
import Redis from "ioredis";
import { FixedWindowLimiter } from "./src/fixed-window.js";

const redis = new Redis();
const limiter = new FixedWindowLimiter(redis, 100, 60);

const result = await limiter.check(`user:${userId}`);

if (!result.allowed) {
  res.setHeader("Retry-After", Math.ceil((result.retryAfterMs ?? 0) / 1000));
  return res.status(429).json({ error: "rate limited" });
}

res.setHeader("X-RateLimit-Limit", result.limit);
res.setHeader("X-RateLimit-Remaining", result.remaining);
```

All four limiters expose the same `check(clientId)` interface.

## Key Takeaways

1. **Atomicity matters**. Any rate limiter that does read-then-write outside a single Redis script will leak requests under concurrency. Always use `EVAL` or `MULTI/EXEC`.
2. **Fixed window is cheap but leaky at boundaries**. Fine for soft limits, bad for security.
3. **Sliding window log is exact but memory-heavy**. Each request stores a timestamp; at high throughput the sorted set grows fast.
4. **Sliding window counter is the usual production choice**. Constant memory, no edge burst, close enough to exact.
5. **Leaky bucket enforces a steady downstream rate**. Choose this when the thing behind the limiter needs predictable QPS, not just a ceiling.

## Cleanup

```bash
docker-compose down -v
```

## Related

- Blog post: [Rate Limiting](https://pulkitxm.com/blogs/system-design/rate-limiting)

