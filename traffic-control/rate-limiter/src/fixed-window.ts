import type { Redis } from "ioredis";
import type { RateLimitResult } from "./connection.js";

const FIXED_WINDOW_SCRIPT = `
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
`;

export class FixedWindowLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly limit: number,
    private readonly windowSeconds: number,
    private readonly namespace: string = "rl:fw"
  ) {}

  async check(clientId: string): Promise<RateLimitResult> {
    const windowIndex = Math.floor(Date.now() / 1000 / this.windowSeconds);
    const key = `${this.namespace}:${clientId}:${windowIndex}`;

    const raw = (await this.redis.eval(
      FIXED_WINDOW_SCRIPT,
      1,
      key,
      this.limit,
      this.windowSeconds
    )) as [number, number, number];

    const [allowed, remaining, ttlMs] = raw;
    return {
      allowed: allowed === 1,
      remaining,
      limit: this.limit,
      retryAfterMs: allowed === 1 ? undefined : ttlMs,
    };
  }
}
