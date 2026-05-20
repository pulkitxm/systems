import { Client } from "@elastic/elasticsearch";
import { Kafka } from "kafkajs";
import Redis from "ioredis";

export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6380"),
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
});

export async function connectRedis(): Promise<void> {
  await redis.connect();
}

export const kafka = new Kafka({
  clientId: "twitter-trends",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

export const elasticsearch = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
});

export const KEYS = {
  tweet: (userId: string, tweetId: string) => `tweet:${userId}:${tweetId}`,
  userTweets: (userId: string) => `user:${userId}:tweets`,
  urlMeta: (urlHash: string) => `url:${urlHash}:meta`,
  urlTweets: (urlHash: string) => `url:${urlHash}:tweets`,
  urlIndex: "urls:index",
  entityCounts: (windowId: string) => `entity:counts:${windowId}`,
  entityDomain: (entity: string) => `entity:domain:${entity}`,
  candidatesRanked: "candidates:ranked",
  trendsCurrent: "trends:current",
  trendsList: "trends:list",
} as const;

export async function closeConnections(): Promise<void> {
  await redis.quit();
  await elasticsearch.close();
}
