import { KEYS, redis } from "../connection.js";
import type { Trend } from "../types.js";

/**
 * Trends API — read path optimized for end-user consumption (precomputed in Trends DB).
 */
export async function getTrending(): Promise<Trend[]> {
  const raw = await redis.get(KEYS.trendsCurrent);
  if (raw) return JSON.parse(raw) as Trend[];

  const list = await redis.lrange(KEYS.trendsList, 0, -1);
  return list.map((r) => JSON.parse(r) as Trend);
}

export async function getTrendByRank(rank: number): Promise<Trend | null> {
  const trends = await getTrending();
  return trends.find((t) => t.rank === rank) ?? null;
}

export function formatTrendsPage(trends: Trend[]): string {
  const lines: string[] = ["=== Twitter Trends Page ===\n"];

  if (trends.length > 0 && trends[0].referenceImage) {
    lines.push(`[Hero Image] ${trends[0].referenceImage}`);
    lines.push(`Top Trend: ${trends[0].entity}`);
    if (trends[0].topArticle) {
      lines.push(`  Article: ${trends[0].topArticle.title} (${trends[0].topArticle.source})`);
    }
    lines.push("");
  }

  for (const t of trends) {
    lines.push(`${t.rank}. ${t.entity} — ${t.tweetCount} posts`);
    lines.push(`   Domain: ${t.domain}`);
    if (t.topArticle) {
      lines.push(`   Top article: ${t.topArticle.title}`);
    }
    if (t.keywords.length) {
      lines.push(`   Keywords: ${t.keywords.slice(0, 5).join(", ")}`);
    }
  }

  return lines.join("\n");
}
