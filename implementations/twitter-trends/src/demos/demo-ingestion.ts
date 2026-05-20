import { closeConnections } from "../connection.js";
import { filterNewsTweets } from "../filtering/news-filter.js";
import { processNewsTweets } from "../filtering/url-fetcher.js";
import { buildSampleTweets, resetPipelineData } from "../pipeline.js";
import { publishTweets } from "../ingestion/producer.js";

async function main(): Promise<void> {
  console.log("=== Demo: Tweet Ingestion & News Filtering ===\n");

  await resetPipelineData();
  const tweets = buildSampleTweets();
  await publishTweets(tweets);
  console.log(`Stored & published ${tweets.length} tweets to Kafka topic (simulated in-process)\n`);

  const newsTweets = filterNewsTweets(tweets);
  console.log(`News tweets (allowed domains): ${newsTweets.length}`);
  for (const t of newsTweets.slice(0, 5)) {
    console.log(`  - ${t.urls?.[0]?.slice(0, 60)}...`);
  }

  const enriched = await processNewsTweets(newsTweets);
  console.log(`\nURL metadata enriched: ${enriched.length} articles`);
  for (const m of enriched.slice(0, 3)) {
    console.log(`  [${m.domain}] ${m.title}`);
  }

  await closeConnections();
}

main().catch(console.error);
