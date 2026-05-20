import { SPIDER } from "../config.js";
import { stagePage } from "../storage/local-staging.js";
import { getOrCreateDocId, recordCrawl } from "../urls-db/url-store.js";
import { shouldCrawlUrl } from "./cooldown.js";
import { extractLinks } from "./link-extractor.js";
import { fetchPage, isMockUrl } from "./mock-fetcher.js";

export interface CrawlStats {
  fetched: number;
  skippedCooldown: number;
  skippedUnknown: number;
  staged: number;
  linksDiscovered: number;
}

export interface SpiderOptions {
  seedUrls: string[];
  maxPages?: number;
  maxDepth?: number;
}

/**
 * BFS spider: seed URLs → download → extract links → queue.
 * Writes HTML to local time-partitioned staging (not S3 per page).
 */
export async function runSpider(opts: SpiderOptions): Promise<CrawlStats> {
  const maxPages = opts.maxPages ?? SPIDER.MAX_PAGES_PER_RUN;
  const maxDepth = opts.maxDepth ?? SPIDER.MAX_DEPTH;

  const stats: CrawlStats = {
    fetched: 0,
    skippedCooldown: 0,
    skippedUnknown: 0,
    staged: 0,
    linksDiscovered: 0,
  };

  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [];

  for (const url of opts.seedUrls) {
    queue.push({ url, depth: 0 });
  }

  while (queue.length > 0 && stats.fetched < maxPages) {
    const { url, depth } = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    if (!isMockUrl(url)) {
      stats.skippedUnknown++;
      continue;
    }

    const decision = shouldCrawlUrl(url);
    if (!decision.shouldCrawl) {
      stats.skippedCooldown++;
      continue;
    }

    const result = await fetchPage(url);
    if (!result) {
      stats.skippedUnknown++;
      continue;
    }

    stats.fetched++;
    const crawledAt = Date.now();
    const docId = getOrCreateDocId(url);

    await stagePage({
      docId,
      url,
      html: result.html,
      crawledAt,
    });

    recordCrawl(url, {
      crawledAt,
      statusCode: result.statusCode,
      bytesDownloaded: result.bytesDownloaded,
    });

    stats.staged++;

    if (depth < maxDepth) {
      const links = extractLinks(result.html, url);
      stats.linksDiscovered += links.length;
      for (const link of links) {
        if (!visited.has(link)) {
          queue.push({ url: link, depth: depth + 1 });
        }
      }
    }
  }

  return stats;
}
