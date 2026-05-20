import { getDomainConfig } from "../urls-db/domain-store.js";
import { extractDomain, getUrlRecord } from "../urls-db/url-store.js";

export interface CrawlDecision {
  shouldCrawl: boolean;
  reason: string;
  domain: string;
  cooldownMs: number;
  lastCrawledAt: number | null;
}

/**
 * Per-domain cooldown: if URL was crawled within cooldown window, discard.
 */
export function shouldCrawlUrl(url: string, now = Date.now()): CrawlDecision {
  const record = getUrlRecord(url);
  const domain = record?.domain ?? extractDomain(url);
  const domainConfig = getDomainConfig(domain);
  const lastCrawledAt = record?.lastCrawledAt ?? null;

  if (lastCrawledAt !== null && now - lastCrawledAt < domainConfig.cooldownMs) {
    return {
      shouldCrawl: false,
      reason: `Crawled ${Math.round((now - lastCrawledAt) / 3600000)}h ago; cooldown ${domainConfig.cooldownMs / 86400000}d`,
      domain,
      cooldownMs: domainConfig.cooldownMs,
      lastCrawledAt,
    };
  }

  return {
    shouldCrawl: true,
    reason: "Within cooldown window or first crawl",
    domain,
    cooldownMs: domainConfig.cooldownMs,
    lastCrawledAt,
  };
}
