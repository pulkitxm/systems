import type { Redis } from "ioredis";
import type { RateLimitResult } from "./connection.js";

const LEAKY_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local leakRatePerMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call("HMGET", key, "level", "ts")
local level = tonumber(data[1]) or 0
local lastTs = tonumber(data[2]) or now

local elapsed = math.max(0, now - lastTs)
local leaked = elapsed * leakRatePerMs
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
`;

export class LeakyBucketLimiter {
  private readonly leakRatePerMs: number;

  constructor(
    private readonly redis: Redis,
    private readonly capacity: number,
    leakRatePerSecond: number,
    private readonly namespace: string = "rl:lb"
  ) {
    this.leakRatePerMs = leakRatePerSecond / 1000;
  }

  async check(clientId: string): Promise<RateLimitResult> {
    const key = `${this.namespace}:${clientId}`;
    const now = Date.now();

    const raw = (await this.redis.eval(
      LEAKY_BUCKET_SCRIPT,
      1,
      key,
      this.capacity,
      this.leakRatePerMs,
      now
    )) as [number, number, number];

    const [allowed, remaining, retryAfterMs] = raw;
    return {
      allowed: allowed === 1,
      remaining,
      limit: this.capacity,
      retryAfterMs: allowed === 1 ? undefined : retryAfterMs,
    };
  }
}
