import { KEYS, redis } from "../connection.js";
import type { Tweet } from "../types.js";

/**
 * Tweets DB — sharded by user_id.
 * All tweets for a user live under user:{userId}:tweets + tweet:{userId}:{tweetId}
 */
export async function storeTweet(tweet: Tweet): Promise<void> {
  const key = KEYS.tweet(tweet.userId, tweet.id);
  await redis.set(key, JSON.stringify(tweet));
  await redis.sadd(KEYS.userTweets(tweet.userId), tweet.id);
}

export async function getTweet(userId: string, tweetId: string): Promise<Tweet | null> {
  const raw = await redis.get(KEYS.tweet(userId, tweetId));
  return raw ? (JSON.parse(raw) as Tweet) : null;
}

export async function getUserTweetIds(userId: string): Promise<string[]> {
  return redis.smembers(KEYS.userTweets(userId));
}
