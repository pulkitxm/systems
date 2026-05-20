import { ENTITY_ALIASES, KNOWN_ENTITIES } from "../config.js";
import type { EntityMention, Tweet } from "../types.js";

/** Filter low-quality tweets (replies, spam, sensitive) */
export function isQualityTweet(tweet: Tweet, recentByUser: Map<string, number>): boolean {
  if (tweet.isReply) return false;
  if (tweet.isSensitive) return false;
  const count = recentByUser.get(tweet.userId) ?? 0;
  if (count >= 5) return false; // same user spamming same window
  recentByUser.set(tweet.userId, count + 1);
  return true;
}

/** Named entity recognition + taxonomy (simulates NER + WordNet mapping) */
export function extractEntities(tweet: Tweet): EntityMention[] {
  const text = tweet.text;
  const mentions: EntityMention[] = [];
  const seen = new Set<string>();

  for (const { patterns, entity, domain } of KNOWN_ENTITIES) {
    if (patterns.some((p) => p.test(text))) {
      const canonical = ENTITY_ALIASES[entity.toLowerCase()] ?? entity;
      if (!seen.has(canonical)) {
        seen.add(canonical);
        mentions.push({
          entity: canonical,
          domain,
          tweetId: tweet.id,
          timestamp: new Date(tweet.createdAt).getTime(),
        });
      }
    }
  }

  return mentions;
}

export function processTweetsForEntities(tweets: Tweet[]): EntityMention[] {
  const recentByUser = new Map<string, number>();
  const all: EntityMention[] = [];

  for (const tweet of tweets) {
    if (!isQualityTweet(tweet, recentByUser)) continue;
    all.push(...extractEntities(tweet));
  }

  return all;
}
