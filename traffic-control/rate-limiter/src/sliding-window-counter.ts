import type { Redis } from "ioredis";
import type { RateLimitResult } from "./connection.js";

const SLIDING_WINDOW_COUNTER_SCRIPT = `
local currentKey = KEYS[1]
local previousKey = KEYS[2]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local elapsedInWindow = tonumber(ARGV[3])

local previousCount = tonumber(redis.call("GET", previousKey) or "0")
local currentCount = tonumber(redis.call("GET", currentKey) or "0")

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
`;

export class SlidingWindowCounterLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly namespace: string = "rl:swc"
  ) {}

  async check(clientId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.windowMs);
    const previousWindow = currentWindow - 1;
    const elapsedInWindow = now - currentWindow * this.windowMs;

    const currentKey = `${this.namespace}:${clientId}:${currentWindow}`;
    const previousKey = `${this.namespace}:${clientId}:${previousWindow}`;

    const raw = (await this.redis.eval(
      SLIDING_WINDOW_COUNTER_SCRIPT,
      2,
      currentKey,
      previousKey,
      this.limit,
      this.windowMs,
      elapsedInWindow
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
