# Rate Limiter on Redis

TypeScript implementation of four popular rate-limiting algorithms on top of Redis, with atomic Lua scripts and runnable demos.

Exercise from Arpit Bhayani's _Designing API Rate Limiter_ lecture: "read and implement leaky bucket, fixed window and sliding window algorithm using Redis".

## Algorithms

| Algorithm | Memory | Accuracy | Burst handling |
|---|---|---|---|
| Fixed Window Counter | 1 counter per window per user | approximate | allows 2× burst at window boundary |
| Sliding Window Log | N timestamps per user | exact | no edge burst |
| Sliding Window Counter | 2 counters per user | approximate | smooths edge burst |
| Leaky Bucket | level + timestamp per user | exact rate | rejects overflow, constant outflow |

Every algorithm runs as a single Lua script inside Redis so the read–check–write is atomic.

## Setup

```bash
pnpm install
```

Start Redis:

```bash
docker-compose up -d
```

Redis Commander UI: http://localhost:8081

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

## Implementation Deep Dive

Every limiter follows the same shape:

1. A **Lua script** as a string constant.
2. A class with a `check(clientId)` method that builds the key(s), grabs the current time, and sends the script to Redis via `EVAL`.
3. Redis runs the script atomically and returns a tuple `{allowed, remaining, retry}` that the class maps into a `RateLimitResult`.

Before the algorithm-by-algorithm walk-through, a few concepts that apply everywhere.

### Why Lua at all

The naive "read, check, write" pattern is three round-trips:

```
t0:  client A → GET counter  → 99
t1:  client B → GET counter  → 99          ← B read before A wrote
t2:  client A → INCR counter → 100
t3:  client B → INCR counter → 101         ← over the limit
```

Both clients read `99`, both decided they were under the cap, and the counter overshoots. This is exactly what `demo-race-condition.ts` reproduces.

Redis is single-threaded and runs one command at a time, but "one command" is the unit of atomicity — not "my three commands in a row". A Lua script, however, is dispatched as a single command (`EVAL`). Redis refuses to interleave anything else while your script runs. So the entire read-check-write becomes one atomic step. Every script here relies on this guarantee.

### How `EVAL` is wired up

ioredis exposes `redis.eval(script, numKeys, ...keysThenArgs)`. That matches the Redis wire protocol for `EVAL`:

```
EVAL <script> <numKeys> <key1> <key2> ... <arg1> <arg2> ...
```

Inside Lua those become `KEYS[1..n]` and `ARGV[1..m]`. The split exists because Redis Cluster uses keys to decide which shard the script runs on. Putting "data" into `ARGV` keeps cluster routing predictable.

Every limiter in this repo returns a **3-element array** `{allowed, remaining, retry}`:

- `allowed` — `1` or `0` (Lua has no booleans in the Redis reply protocol).
- `remaining` — how many requests are left in the window / capacity.
- `retry` — milliseconds until the client should try again (0 when allowed).

The TypeScript side unpacks that tuple and maps it into `RateLimitResult`.

### Time

All "now" values are generated on the **client side** (`Date.now()`) and passed in as `ARGV`. We avoid `redis.call("TIME")` inside scripts for two reasons:

1. `TIME` is not deterministic, so older Redis versions treated it as non-replication-safe. Passing `now` keeps scripts deterministic.
2. In Redis Cluster, all nodes may disagree on time. Client-side `Date.now()` is consistent per-request for the duration of the script.

---

### Fixed Window Counter, line by line

File: [`src/fixed-window.ts`](./src/fixed-window.ts)

**Idea.** Bucket time into fixed slots of size `windowSeconds`. Each slot has its own counter key. Increment on every request. Reject when the counter exceeds the limit. Let Redis `EXPIRE` delete the key when the slot ends.

**Key construction (TypeScript side).**

```ts
const windowIndex = Math.floor(Date.now() / 1000 / this.windowSeconds);
const key = `${this.namespace}:${clientId}:${windowIndex}`;
```

`windowIndex` is just "which 5-second slot are we in right now" — an integer that ticks over once per window. `Math.floor(now_seconds / 5)` at `t=12s` gives `2`, at `t=14s` gives `2`, at `t=15s` gives `3`. Two requests in the same slot share the same key. Cross a boundary and you land on a new key with a fresh counter.

This is the whole reason fixed window is cheap: no explicit reset logic, no cleanup script — the key literally ceases to exist after its TTL.

**The Lua script.**

```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowSeconds = tonumber(ARGV[2])

local count = redis.call("INCR", key)
if count == 1 then
  redis.call("EXPIRE", key, windowSeconds)
end

local ttl = redis.call("PTTL", key)
if count > limit then
  return {0, 0, ttl}
end
return {1, limit - count, ttl}
```

Step by step:

1. **`INCR key`** — atomic counter-plus-one. If the key didn't exist, Redis creates it with value `0` and then increments, so the first call returns `1`.
2. **`if count == 1 then EXPIRE ...`** — only the *first* call in a window sets the TTL. If we called `EXPIRE` on every request, the key would never expire (each request would push the expiry further out). This is a classic fixed-window bug.
3. **`PTTL key`** — remaining TTL in milliseconds. We use this as the retry hint, which doubles as "when does this window close". Using `PTTL` instead of recomputing from `Date.now()` means we read the authoritative value from Redis itself.
4. **`count > limit` → reject**. Note: the request that *reaches* the limit (`count == limit`) is still allowed; only `count == limit + 1` and beyond are rejected. This matches the "allow exactly `limit` requests per window" semantic.

**The `INCR` + `EXPIRE` race.** Even inside Lua there's a subtlety people miss: if you do

```lua
redis.call("INCR", key)
redis.call("EXPIRE", key, window)
```

unconditionally, you reset the TTL every request — making the window longer than it should be. Gating `EXPIRE` on `count == 1` is the fix, and it's only safe *because* Lua atomicity guarantees these two commands are adjacent.

**Why the edge burst exists.** Because the key identity changes at window boundaries. At `t=4.9s` requests hit `...:0`, at `t=5.0s` they hit `...:1`. Those are two different keys with two independent counters. A client who spent the first 4.9s silent, hammered 5 requests at the end, then hammered 5 more at the start of the next window sent 10 requests in ~200ms and every single one was "within the rules" by this algorithm's books. The `demo-fixed-window.ts` script literally sleeps to line up with a window boundary and reproduces this.

---

### Sliding Window Log, line by line

File: [`src/sliding-window-log.ts`](./src/sliding-window-log.ts)

**Idea.** Store every request's timestamp in a sorted set. "How many requests in the last 5 seconds?" is answered by the set's current size after purging anything older than `now - windowMs`. Perfectly accurate because it literally remembers every request.

**Why a sorted set.** Redis sorted sets (`ZSET`) give you O(log N) insert, O(log N + K) range scan by score, and O(log N) range delete. We use the **timestamp as the score** and a unique-enough string as the member. The set ordering is the chronological order of requests for free.

**Member uniqueness.**

```ts
const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
```

`ZADD` treats members as a set — adding the same member twice updates its score instead of creating a second entry. If two concurrent requests happened to share the exact millisecond timestamp, using `now` alone as the member would silently drop one of them. The random suffix makes collisions vanishingly unlikely.

Production-grade alternative: use `XADD` on a stream, or `ZADD` with a per-client monotonic sequence number. The random suffix is fine for a demo.

**The Lua script.**

```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local member = ARGV[4]

redis.call("ZREMRANGEBYSCORE", key, 0, now - windowMs)
local count = redis.call("ZCARD", key)

if count >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local retryAfter = 0
  if oldest[2] then
    retryAfter = (tonumber(oldest[2]) + windowMs) - now
  end
  return {0, 0, retryAfter}
end

redis.call("ZADD", key, now, member)
redis.call("PEXPIRE", key, windowMs)
return {1, limit - count - 1, 0}
```

Step by step:

1. **`ZREMRANGEBYSCORE key 0 (now - windowMs)`** — delete all entries whose timestamp is older than the window. In English: "forget every request that no longer counts". This happens *before* we check the count, so stale entries never inflate the count.
2. **`ZCARD key`** — the exact number of requests still inside the rolling window. This is why the algorithm is called "exact": no approximation, no weighting.
3. **`count >= limit` → reject with retry hint.** The retry hint is the interesting part: `ZRANGE key 0 0 WITHSCORES` fetches the oldest surviving entry. Once that entry ages out (`oldest.score + windowMs` time from now), there will be room for one more request. That's the exact moment the client should try again.
4. **Otherwise: `ZADD` + `PEXPIRE`**. `PEXPIRE` is belt-and-suspenders — if a user stops sending traffic, `ZREMRANGEBYSCORE` would never run again and the set would sit around forever. `PEXPIRE windowMs` lets Redis reclaim the key on its own if nothing touches it.
5. **`limit - count - 1`** — the `-1` accounts for the request we just allowed but have not yet counted.

**Why no edge burst.** There's no concept of "current window" and "next window" anymore. The window is always "the last `windowMs` from this exact moment". You cannot game a boundary because there isn't one.

**The memory cost.** Every surviving request is one sorted-set entry. At 1000 req/s with a 60s window, that's 60 000 entries per user. A limiter that's itself using too much memory is worse than one that's slightly approximate, which is why the counter variant exists.

---

### Sliding Window Counter, line by line

File: [`src/sliding-window-counter.ts`](./src/sliding-window-counter.ts)

**Idea.** Keep the two fixed-window counters: the one for the current slot and the one for the previous slot. Estimate the true sliding-window count by taking all of `currentCount` plus a linearly-decaying fraction of `previousCount`. Two integers per user — same memory as fixed window — but the numbers behave as if the window slides.

**The key math.** If we're `elapsedInWindow` milliseconds into the current slot (slot length = `windowMs`), a true sliding window of length `windowMs` overlaps:

- 100% of the current slot from its start to now.
- `(windowMs - elapsedInWindow) / windowMs` of the previous slot (its tail).

So the estimated count is:

```
weight    = (windowMs - elapsedInWindow) / windowMs
estimated = floor(previousCount * weight) + currentCount
```

At the start of a slot (`elapsedInWindow == 0`), the previous window contributes fully; at the end (`elapsedInWindow == windowMs`), it contributes nothing. That's the smoothing.

**Key construction.**

```ts
const currentWindow = Math.floor(now / this.windowMs);
const previousWindow = currentWindow - 1;
const elapsedInWindow = now - currentWindow * this.windowMs;

const currentKey  = `${this.namespace}:${clientId}:${currentWindow}`;
const previousKey = `${this.namespace}:${clientId}:${previousWindow}`;
```

Note the script takes **two keys** (`EVAL script 2 currentKey previousKey ...`). This matters for Redis Cluster: both keys must hash to the same slot, otherwise Redis refuses the script. ioredis hash-tags are how you force that in production (`{user:42}:current` and `{user:42}:previous`), but for a single-node demo the default is fine.

**The Lua script.**

```lua
local currentKey = KEYS[1]
local previousKey = KEYS[2]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local elapsedInWindow = tonumber(ARGV[3])

local previousCount = tonumber(redis.call("GET", previousKey) or "0")
local currentCount  = tonumber(redis.call("GET", currentKey)  or "0")

local weight = (windowMs - elapsedInWindow) / windowMs
local estimated = math.floor(previousCount * weight) + currentCount

if estimated >= limit then
  return {0, 0, windowMs - elapsedInWindow}
end

local newCount = redis.call("INCR", currentKey)
if newCount == 1 then
  redis.call("PEXPIRE", currentKey, windowMs * 2)
end

return {1, limit - estimated - 1, 0}
```

Step by step:

1. **Read both counters.** If either key is absent, Lua's `redis.call("GET", …)` returns `false`; `or "0"` coerces that into `"0"` before `tonumber`.
2. **Compute `weight` and `estimated`.** `floor` on the weighted previous count avoids off-by-one inflation from rounding.
3. **Reject path.** Retry hint is `windowMs - elapsedInWindow`: once we cross into the next slot, the current-slot's count becomes the new previous-slot's count and the weight starts decaying from 1.0 again, making room.
4. **Allow path.** `INCR currentKey`. The `if newCount == 1 then PEXPIRE ... windowMs * 2` line is the crucial TTL trick: the previous slot's key must still exist while we are in the current slot, otherwise the weighting breaks. Setting TTL to `2 × windowMs` guarantees the previous slot survives exactly as long as we might read it, and not longer.

**Cloudflare uses exactly this algorithm** and reported 0.003% of requests classified incorrectly across 400M requests. For 99.997% accuracy at 2-integers-per-user, it's hard to beat.

---

### Leaky Bucket, line by line

File: [`src/leaky-bucket.ts`](./src/leaky-bucket.ts)

**Idea.** Think of a bucket with a fixed capacity and a hole in the bottom. Each request pours 1 unit of water in; water leaks out at a constant rate. If pouring would overflow, reject. If the bucket is empty, no more water leaks. The steady-state throughput is capped at the leak rate, with the capacity acting as a buffer for short bursts.

**State.** Per user, two numbers:

- `level` — current water level, continuous (not integer).
- `ts` — last time we touched the bucket.

Stored as a Redis hash (`HMGET`/`HMSET`). A hash is nicer than two independent keys here because both fields must be read and written atomically, and hashes give you that for free in Lua.

**Why "continuous leak" is lazy in implementation.** We do not run a background job to "drain" buckets every tick. Instead, each incoming request computes on arrival: "the last time we touched this bucket was `lastTs`, so `now - lastTs` milliseconds of leakage should have happened since". That's an O(1) computation and it means idle buckets cost exactly nothing.

**Leak rate units.** The constructor accepts `leakRatePerSecond`; we convert to `leakRatePerMs` once:

```ts
this.leakRatePerMs = leakRatePerSecond / 1000;
```

Staying in milliseconds everywhere matches `Date.now()`'s unit and avoids a division in the hot path.

**The Lua script.**

```lua
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local leakRatePerMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call("HMGET", key, "level", "ts")
local level  = tonumber(data[1]) or 0
local lastTs = tonumber(data[2]) or now

local elapsed = math.max(0, now - lastTs)
local leaked  = elapsed * leakRatePerMs
level = math.max(0, level - leaked)

if level + 1 > capacity then
  local overflow = (level + 1) - capacity
  local retryAfter = math.ceil(overflow / leakRatePerMs)
  redis.call("HMSET", key, "level", level, "ts", now)
  redis.call("PEXPIRE", key, math.ceil(capacity / leakRatePerMs))
  return {0, 0, retryAfter}
end

level = level + 1
redis.call("HMSET", key, "level", level, "ts", now)
redis.call("PEXPIRE", key, math.ceil(capacity / leakRatePerMs))

local remaining = math.floor(capacity - level)
return {1, remaining, 0}
```

Step by step:

1. **Load state.** `HMGET` returns a Lua table; missing fields come back as `false`. `tonumber(false)` is `nil`, so `or 0` and `or now` handle the first-time case: a fresh bucket starts empty with `lastTs = now`, so `elapsed` on the very first call is `0`, `leaked` is `0`, and the starting level stays at `0`.
2. **Leak based on elapsed time.** `elapsed * leakRatePerMs` is the water that drained during the idle period. `math.max(0, …)` clamps the level at `0` — we can't drain past empty.
3. **Overflow check.** `level + 1` simulates "try to add this request". If that would cross `capacity`, reject.
4. **Retry hint on reject.** `overflow = (level + 1) - capacity` is how much water would be over the brim. `overflow / leakRatePerMs` is how many milliseconds of leakage it'll take to make that much room. `math.ceil` rounds up so the client isn't told to retry slightly too early.
5. **Persist state even on reject.** Note that we write `HMSET` with the *leaked* level and the new `ts`. This is important: if we didn't persist the leak, the next request would recompute `elapsed` from `lastTs` — the original `lastTs` from many requests ago — and eventually overflow floating-point precision or do redundant work.
6. **Allow path.** Bump the level by 1, persist, refresh TTL.
7. **TTL.** `capacity / leakRatePerMs` is "the time it takes a full bucket to drain to empty". Any bucket untouched longer than that has drained completely anyway, so losing its state is fine — we set TTL to exactly that horizon.

**Why leaky bucket is different from token bucket.** They're often confused. Token bucket *allows* a burst up to capacity (tokens accumulate during idle periods). Leaky bucket *also* allows a burst up to capacity, but then every subsequent request is forced into the leak-rate cadence. Leaky bucket's promise is "the downstream system sees no more than R req/s, ever, regardless of the arrival pattern". Token bucket does not give that guarantee.

---

### Summary of the trade-offs

| Script | Data structure | Atomic ops | Memory per user | Retry hint |
|---|---|---|---|---|
| Fixed Window | string (counter) | `INCR`, `EXPIRE`, `PTTL` | one integer + TTL | exact (from `PTTL`) |
| Sliding Window Log | sorted set | `ZREMRANGEBYSCORE`, `ZCARD`, `ZADD`, `ZRANGE`, `PEXPIRE` | one entry per surviving request | exact (from oldest entry) |
| Sliding Window Counter | two strings | `GET` × 2, `INCR`, `PEXPIRE` | two integers | slot boundary (approximate) |
| Leaky Bucket | hash `{level, ts}` | `HMGET`, `HMSET`, `PEXPIRE` | one hash of two fields | exact (from overflow math) |

All four are single `EVAL` calls with no cross-key reads (except the sliding window counter, which requires hash tags in a clustered deployment).

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
