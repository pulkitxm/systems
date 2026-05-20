import { closeConnections } from "../connection.js";
import { buildSampleTweets, resetPipelineData, runFullPipeline } from "../pipeline.js";
import { formatTrendsPage, getTrending } from "../services/trends-service.js";

async function main(): Promise<void> {
  console.log("Seeding Twitter Trends pipeline...\n");

  await resetPipelineData();
  const result = await runFullPipeline(buildSampleTweets());

  console.log(`Published ${result.tweets.length} tweets`);
  console.log(`News-filtered: ${result.newsTweets.length} tweets`);
  console.log(`Clusters created: ${result.clusters.length}`);
  console.log(`Trends computed: ${result.trends.length}\n`);

  const trends = await getTrending();
  console.log(formatTrendsPage(trends));

  await closeConnections();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
