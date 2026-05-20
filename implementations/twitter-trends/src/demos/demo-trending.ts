import { closeConnections } from "../connection.js";
import { buildSampleTweets, resetPipelineData, runFullPipeline } from "../pipeline.js";
import { formatTrendsPage, getTrending } from "../services/trends-service.js";
import { searchClusters } from "../services/clustering-service.js";

async function main(): Promise<void> {
  console.log("=== Demo: Entity Trending & Trends Page ===\n");

  await resetPipelineData();
  await runFullPipeline(buildSampleTweets());

  const trends = await getTrending();
  console.log(formatTrendsPage(trends));

  console.log("\n--- News Clustering Service: query 'cricket' ---");
  const clusters = await searchClusters("cricket");
  for (const c of clusters) {
    console.log(`  Cluster ${c.clusterId.slice(0, 8)}... keywords: ${c.keywords.slice(0, 5).join(", ")}`);
  }

  await closeConnections();
}

main().catch(console.error);
