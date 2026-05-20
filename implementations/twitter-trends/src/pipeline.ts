import { clusterArticles } from "./clustering/clusterer.js";
import { deleteAllClusters, ensureClusterIndex, indexClusters } from "./clustering/cluster-store.js";
import { filterNewsTweets } from "./filtering/news-filter.js";
import { getAllUrlMetadata, processNewsTweets } from "./filtering/url-fetcher.js";
import { createTweet, publishTweets } from "./ingestion/producer.js";
import type { Tweet } from "./types.js";
import { aggregateMentions } from "./trending/aggregator.js";
import { processTweetsForEntities } from "./trending/entity-extractor.js";
import { scoreAndRankEntities } from "./trending/scorer.js";
import { runTrendsJob } from "./trending/trends-job.js";

export function buildSampleTweets(): Tweet[] {
  const users = ["u1", "u2", "u3", "u4", "u5", "u6", "spam_bot"];
  return [
    createTweet(users[0], "What a day for Virat Kohli at the SCG! #BGT https://www.cricbuzz.com/cricket-news/bgt-india-lead"),
    createTweet(users[1], "Border-Gavaskar Trophy heating up — Kohli masterclass https://www.bbc.com/sport/cricket/ind-aus-preview"),
    createTweet(users[2], "WPL final was insane! Mumbai Indians win https://www.espn.com/cricket/wpl-final"),
    createTweet(users[3], "Women's Premier League 2024 — best tournament yet https://www.espn.com/cricket/wpl-2024"),
    createTweet(users[0], "India vs Australia decider this week https://www.bbc.com/sport/cricket/india-australia"),
    createTweet(users[4], "Barack Obama addresses climate summit — powerful speech https://www.nytimes.com/obama-climate"),
    createTweet(users[5], "Obama on emissions targets at world leaders meet https://www.nytimes.com/climate-obama-2024"),
    createTweet(users[1], "Elon Musk testifies on AI regulation https://www.reuters.com/tech/musk-ai-hearing"),
    createTweet(users[2], "Taylor Swift announces new tour dates! So excited"),
    createTweet(users[3], "Virat Kohli century — legendary #cricket"),
    createTweet(users[4], "BGT day 3 highlights #BorderGavaskar"),
    createTweet(users[0], "Great match today"),
    createTweet(users[6], "buy followers cheap!!!", { isSensitive: true }),
    createTweet(users[6], "spam spam spam spam spam"),
    createTweet(users[6], "spam spam spam spam spam"),
    createTweet(users[6], "spam spam spam spam spam"),
    createTweet(users[6], "spam spam spam spam spam"),
    createTweet(users[6], "spam spam spam spam spam"),
    createTweet(users[0], "reply thread", { isReply: true }),
    createTweet(users[1], "random link https://unknown-blog.xyz/post"),
  ];
}

export async function ensureStoresConnected(): Promise<void> {
  const { connectRedis, redis } = await import("./connection.js");
  if (redis.status !== "ready") await connectRedis();
}

export async function runFullPipeline(tweets?: Tweet[]): Promise<{
  tweets: Tweet[];
  newsTweets: Tweet[];
  clusters: Awaited<ReturnType<typeof clusterArticles>>;
  trends: Awaited<ReturnType<typeof runTrendsJob>>;
}> {
  const allTweets = tweets ?? buildSampleTweets();

  await ensureStoresConnected();
  await publishTweets(allTweets);

  const newsTweets = filterNewsTweets(allTweets);
  await processNewsTweets(newsTweets);

  const urlData = await getAllUrlMetadata();
  const articles = urlData.map((u) => ({
    metadata: u,
    tweetCount: u.tweetIds.length,
  }));

  await ensureClusterIndex();
  const clusters = clusterArticles(articles);
  await indexClusters(clusters);

  const mentions = processTweetsForEntities(allTweets);
  await aggregateMentions(mentions);
  await scoreAndRankEntities();
  const trends = await runTrendsJob();

  return { tweets: allTweets, newsTweets, clusters, trends };
}

export async function resetPipelineData(): Promise<void> {
  const { redis, KEYS } = await import("./connection.js");
  const keys = await redis.keys("tweet:*");
  const urlKeys = await redis.keys("url:*");
  const entityKeys = await redis.keys("entity:*");
  const other = [KEYS.urlIndex, KEYS.candidatesRanked, KEYS.trendsCurrent, KEYS.trendsList];
  const all = [...keys, ...urlKeys, ...entityKeys, ...other];
  if (all.length) await redis.del(...all);
  await deleteAllClusters();
}
