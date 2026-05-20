import { TRENDING } from "../config.js";
import { KEYS, redis } from "../connection.js";
import type { Trend } from "../types.js";
import { searchClusters } from "../services/clustering-service.js";
import { getTopCandidates } from "./scorer.js";

/**
 * Periodic job: top candidate entities → enrich via News Clustering Service → Trends DB
 */
export async function runTrendsJob(): Promise<Trend[]> {
  const candidates = await getTopCandidates(TRENDING.TOP_TRENDS);
  const trends: Trend[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const clusters = await searchClusters(c.entity, 1);
    const cluster = clusters[0];

    const trend: Trend = {
      rank: i + 1,
      entity: c.entity,
      domain: c.domain,
      tweetCount: c.tweetCount,
      keywords: cluster?.keywords ?? [c.entity],
      referenceImage: cluster?.referenceImage,
      topArticle: cluster?.topArticles[0]
        ? {
            title: cluster.topArticles[0].title,
            url: cluster.topArticles[0].url,
            source: cluster.topArticles[0].source,
          }
        : undefined,
      clusterId: cluster?.clusterId,
    };
    trends.push(trend);
  }

  await redis.set(KEYS.trendsCurrent, JSON.stringify(trends));
  await redis.del(KEYS.trendsList);
  for (const t of trends) {
    await redis.rpush(KEYS.trendsList, JSON.stringify(t));
  }

  return trends;
}
