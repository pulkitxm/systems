import { closeConnections } from "../connection.js";
import { clusterArticles } from "../clustering/clusterer.js";
import { ensureClusterIndex, indexClusters } from "../clustering/cluster-store.js";
import { filterNewsTweets } from "../filtering/news-filter.js";
import { getAllUrlMetadata, processNewsTweets } from "../filtering/url-fetcher.js";
import { buildSampleTweets, resetPipelineData } from "../pipeline.js";
import { publishTweets } from "../ingestion/producer.js";
import { searchClusters } from "../services/clustering-service.js";

async function main(): Promise<void> {
  console.log("=== Demo: News Clustering (TF-IDF + K-Means) ===\n");

  await resetPipelineData();
  const tweets = buildSampleTweets();
  await publishTweets(tweets);

  const newsTweets = filterNewsTweets(tweets);
  await processNewsTweets(newsTweets);

  const urlData = await getAllUrlMetadata();
  const articles = urlData.map((u) => ({
    metadata: u,
    tweetCount: u.tweetIds.length,
  }));

  const clusters = clusterArticles(articles);
  await ensureClusterIndex();
  await indexClusters(clusters);

  console.log(`Created ${clusters.length} clusters:\n`);
  for (const c of clusters) {
    console.log(`Cluster: ${c.keywords.slice(0, 5).join(", ")}`);
    console.log(`  Domain: ${c.domain} | Tweets: ${c.tweetCount} | Recency: ${c.recencyScore.toFixed(2)}`);
    console.log(`  Top article: ${c.topArticles[0]?.title}`);
    console.log("");
  }

  console.log('Query Elasticsearch for "cricket":');
  const cricket = await searchClusters("cricket");
  for (const r of cricket) {
    console.log(`  - ${r.keywords.slice(0, 4).join(", ")} (${r.domain})`);
  }

  await closeConnections();
}

main().catch(console.error);
