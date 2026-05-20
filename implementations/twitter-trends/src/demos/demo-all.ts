import { closeConnections } from "../connection.js";
import { buildSampleTweets, resetPipelineData, runFullPipeline } from "../pipeline.js";
import { formatTrendsPage, getTrending } from "../services/trends-service.js";
import { searchClusters } from "../services/clustering-service.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Twitter Trends — Full End-to-End Pipeline Demo       ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  await resetPipelineData();

  console.log("Stage 1: Tweet ingestion → Kafka (tweets.published) + Tweets DB (Redis)");
  console.log("Stage 2: News filter → URL fetcher → KV store");
  console.log("Stage 3: TF-IDF + K-Means clustering → Elasticsearch");
  console.log("Stage 4: Entity extraction → aggregation → scorer");
  console.log("Stage 5: Trends job → enrichment → Trends DB");
  console.log("Stage 6: Trends API (read path)\n");

  const result = await runFullPipeline(buildSampleTweets());

  console.log("--- Pipeline Summary ---");
  console.log(`Tweets ingested:     ${result.tweets.length}`);
  console.log(`News URLs captured:  ${result.newsTweets.length}`);
  console.log(`Clusters in ES:      ${result.clusters.length}`);
  console.log(`Trending entities:   ${result.trends.length}\n`);

  console.log("--- Trends Page (what the user sees) ---\n");
  console.log(formatTrendsPage(await getTrending()));

  console.log("\n--- News Clustering Service ---");
  for (const q of ["cricket", "Obama", "technology"]) {
    const hits = await searchClusters(q, 3);
    console.log(`Query "${q}": ${hits.length} cluster(s)`);
  }

  await closeConnections();
}

main().catch(console.error);
