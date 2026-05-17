import Redis from "ioredis";

export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

export const KEYS = {
  LOCATIONS: "tinder:locations",
  PROFILE: (userId: string) => `tinder:profile:${userId}`,
  PROFILES_INDEX: "tinder:profiles:all",
  FEED: (userId: string) => `tinder:feed:${userId}`,
  FEED_ITEM: (userId: string, candidateId: string) =>
    `tinder:feed:${userId}:${candidateId}`,
  SEEN: (userId: string) => `tinder:seen:${userId}`,
  MATCHES: (userId: string) => `tinder:matches:${userId}`,
  MATCH: (matchId: string) => `tinder:match:${matchId}`,
  FEED_QUEUE: "tinder:feed-queue",
} as const;

export async function closeConnection(): Promise<void> {
  await redis.quit();
}
