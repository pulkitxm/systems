import Redis from "ioredis";

export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6381"),
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
});

export const KEYS = {
  range: (id: number) => `range:${id}`,
  rangeIndex: "ranges:index",
  url: (shortCode: string) => `url:${shortCode}`,
  urlIndex: "urls:index",
} as const;

export async function connectRedis(): Promise<void> {
  if (redis.status !== "ready") await redis.connect();
}

export async function closeConnection(): Promise<void> {
  await redis.quit();
}
