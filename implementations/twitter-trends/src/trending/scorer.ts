import { ENTITY_ALIASES, TRENDING } from "../config.js";
import { KEYS, redis } from "../connection.js";
import type { TrendingEntity } from "../types.js";
import { getEntityCounts, getEntityDomain } from "./aggregator.js";

function canonicalEntity(name: string): string {
  const lower = name.toLowerCase();
  return ENTITY_ALIASES[lower] ?? name;
}

/** Merge aliases and score entities by volume + recency weight */
export async function scoreAndRankEntities(): Promise<TrendingEntity[]> {
  const counts = await getEntityCounts();
  const merged = new Map<string, { count: number; domain: string }>();

  for (const [entity, count] of counts) {
    const canonical = canonicalEntity(entity);
    const domain = await getEntityDomain(entity);
    const existing = merged.get(canonical);
    if (existing) {
      existing.count += count;
    } else {
      merged.set(canonical, { count, domain });
    }
  }

  const maxCount = Math.max(...[...merged.values()].map((v) => v.count), 1);
  const candidates: TrendingEntity[] = [];

  for (const [entity, { count, domain }] of merged) {
    const volumeScore = count / maxCount;
    const score =
      volumeScore * TRENDING.VOLUME_WEIGHT + TRENDING.RECENCY_WEIGHT;
    candidates.push({ entity, domain, score, tweetCount: Math.round(count) });
  }

  candidates.sort((a, b) => b.score - a.score);

  const pipe = redis.pipeline();
  await redis.del(KEYS.candidatesRanked);
  for (const c of candidates) {
    pipe.zadd(KEYS.candidatesRanked, c.score, JSON.stringify(c));
  }
  await pipe.exec();

  return candidates;
}

export async function getTopCandidates(limit = TRENDING.TOP_TRENDS): Promise<TrendingEntity[]> {
  const raw = await redis.zrevrange(KEYS.candidatesRanked, 0, limit - 1);
  return raw.map((r) => JSON.parse(r) as TrendingEntity);
}
