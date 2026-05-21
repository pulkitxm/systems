import type { Redis } from "ioredis";
import type { RateLimitResult } from "./connection.js";

const SLIDING_WINDOW_LOG_SCRIPT = `
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
`;

export class SlidingWindowLogLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly namespace: string = "rl:swl"
  ) {}

  async check(clientId: string): Promise<RateLimitResult> {
    const key = `${this.namespace}:${clientId}`;
    const now = Date.now();
    const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

    const raw = (await this.redis.eval(
      SLIDING_WINDOW_LOG_SCRIPT,
      1,
      key,
      this.limit,
      this.windowMs,
      now,
      member
    )) as [number, number, number];

    const [allowed, remaining, retryAfterMs] = raw;
    return {
      allowed: allowed === 1,
      remaining,
      limit: this.limit,
      retryAfterMs: allowed === 1 ? undefined : retryAfterMs,
    };
  }
}
