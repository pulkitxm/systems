import { KEYS, redis } from "../connection.js";
import { getDomain, urlHash } from "../utils.js";
import type { Tweet, UrlMetadata } from "../types.js";

/** Simulated article catalog for demo URLs */
const MOCK_ARTICLES: Record<string, Omit<UrlMetadata, "url" | "fetchedAt" | "domain">> = {
  "cricbuzz.com": {
    title: "Border-Gavaskar Trophy: India take lead in Sydney",
    description: "India dominate day 3 at SCG with Kohli and Jadeja in form. BGT 2024 live updates.",
    image: "https://example.com/bgt.jpg",
    tags: ["cricket", "BGT", "India", "Australia", "Sydney"],
  },
  "espn.com": {
    title: "WPL 2024: Mumbai Indians clinch thriller",
    description: "Women's Premier League final goes down to the last over.",
    image: "https://example.com/wpl.jpg",
    tags: ["cricket", "WPL", "women", "Mumbai Indians"],
  },
  "nytimes.com": {
    title: "Obama speaks on climate policy at summit",
    description: "Former president Barack Obama addresses world leaders on emissions targets.",
    image: "https://example.com/obama.jpg",
    tags: ["politics", "Obama", "climate", "summit"],
  },
  "bbc.com": {
    title: "India vs Australia: series decider preview",
    description: "Cricket analysts break down the final Test of the Border-Gavaskar Trophy.",
    image: "https://example.com/ind-aus.jpg",
    tags: ["cricket", "India", "Australia", "Test"],
  },
  "reuters.com": {
    title: "Tech leaders gather as AI regulation debate heats up",
    description: "Elon Musk and industry CEOs testify before lawmakers.",
    image: "https://example.com/tech.jpg",
    tags: ["technology", "AI", "Musk", "regulation"],
  },
};

function mockFetch(url: string): UrlMetadata {
  const domain = getDomain(url) || "unknown";
  const base =
    Object.entries(MOCK_ARTICLES).find(([d]) => domain.includes(d))?.[1] ??
    MOCK_ARTICLES["bbc.com"];

  return {
    url,
    title: base.title,
    description: base.description,
    image: base.image,
    tags: [...base.tags],
    domain,
    fetchedAt: new Date().toISOString(),
  };
}

export async function enrichUrl(url: string, tweetId: string): Promise<UrlMetadata> {
  const hash = urlHash(url);
  const metaKey = KEYS.urlMeta(hash);
  const tweetsKey = KEYS.urlTweets(hash);

  let meta = await redis.get(metaKey);
  if (!meta) {
    const fetched = mockFetch(url);
    await redis.set(metaKey, JSON.stringify(fetched));
    await redis.sadd(KEYS.urlIndex, hash);
    meta = JSON.stringify(fetched);
  }

  await redis.sadd(tweetsKey, tweetId);
  return JSON.parse(meta) as UrlMetadata;
}

export async function processNewsTweets(tweets: Tweet[]): Promise<UrlMetadata[]> {
  const results: UrlMetadata[] = [];
  for (const tweet of tweets) {
    for (const url of tweet.urls ?? []) {
      const meta = await enrichUrl(url, tweet.id);
      results.push(meta);
    }
  }
  return results;
}

export async function getAllUrlMetadata(): Promise<Array<UrlMetadata & { tweetIds: string[] }>> {
  const hashes = await redis.smembers(KEYS.urlIndex);
  const out: Array<UrlMetadata & { tweetIds: string[] }> = [];

  for (const hash of hashes) {
    const metaRaw = await redis.get(KEYS.urlMeta(hash));
    if (!metaRaw) continue;
    const meta = JSON.parse(metaRaw) as UrlMetadata;
    const tweetIds = await redis.smembers(KEYS.urlTweets(hash));
    out.push({ ...meta, tweetIds });
  }
  return out;
}
