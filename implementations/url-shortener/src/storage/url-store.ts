import { SHARD_COUNT } from "../config.js";
import { KEYS, redis } from "../connection.js";
import type { UrlRecord } from "../types.js";

/**
 * Shard key by short_code — conceptual partitioning for load (not storage volume).
 * hash(short_code) % SHARD_COUNT → which logical shard owns this key.
 */
export function getShardForShortCode(shortCode: string): number {
  let hash = 0;
  for (let i = 0; i < shortCode.length; i++) {
    hash = (hash * 31 + shortCode.charCodeAt(i)) >>> 0;
  }
  return hash % SHARD_COUNT;
}

export async function storeUrl(
  shortCode: string,
  url: string,
  userId: string
): Promise<UrlRecord> {
  const shard = getShardForShortCode(shortCode);
  const record: UrlRecord = {
    shortCode,
    url,
    userId,
    createdAt: new Date().toISOString(),
  };

  const key = KEYS.url(shortCode);
  await redis.hset(key, {
    url: record.url,
    userId: record.userId,
    createdAt: record.createdAt,
    shard: String(shard),
  });
  await redis.sadd(KEYS.urlIndex, shortCode);

  return record;
}

export async function resolveUrl(shortCode: string): Promise<UrlRecord | null> {
  const data = await redis.hgetall(KEYS.url(shortCode));
  if (!data.url) return null;

  return {
    shortCode,
    url: data.url,
    userId: data.userId,
    createdAt: data.createdAt,
  };
}

export async function getAllShortCodes(): Promise<string[]> {
  return redis.smembers(KEYS.urlIndex);
}

export async function clearAllUrls(): Promise<void> {
  const codes = await getAllShortCodes();
  const keys = codes.map((c) => KEYS.url(c));
  if (keys.length) await redis.del(...keys);
  await redis.del(KEYS.urlIndex);
}
