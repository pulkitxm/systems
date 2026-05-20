import { TRENDING } from "../config.js";
import { KEYS, redis } from "../connection.js";
import { timeWindowId } from "../utils.js";
import type { EntityMention } from "../types.js";

export async function aggregateMentions(mentions: EntityMention[]): Promise<void> {
  const windowId = timeWindowId(Date.now(), TRENDING.TIME_WINDOW_MS);
  const key = KEYS.entityCounts(windowId);

  for (const m of mentions) {
    await redis.zincrby(key, 1, m.entity);
    await redis.set(KEYS.entityDomain(m.entity), m.domain);
  }

  await redis.expire(key, Math.ceil(TRENDING.TIME_WINDOW_MS / 1000) * 4);
}

export async function getEntityCounts(windowId?: string): Promise<Map<string, number>> {
  const wid = windowId ?? timeWindowId(Date.now(), TRENDING.TIME_WINDOW_MS);
  const key = KEYS.entityCounts(wid);
  const pairs = await redis.zrevrange(key, 0, -1, "WITHSCORES");

  const counts = new Map<string, number>();
  for (let i = 0; i < pairs.length; i += 2) {
    counts.set(pairs[i], parseFloat(pairs[i + 1]));
  }
  return counts;
}

export async function getEntityDomain(entity: string): Promise<string> {
  return (await redis.get(KEYS.entityDomain(entity))) ?? "general";
}
