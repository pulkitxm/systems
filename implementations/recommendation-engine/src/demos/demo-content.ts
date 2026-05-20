import { closeDb } from "../data/db.js";
import { seedDatabase } from "../data/seed-data.js";
import { getOrdersByUser } from "../data/order-store.js";
import { getProductById } from "../data/product-store.js";
import { clusterProducts } from "../content-filtering/clusterer.js";
import { getAllProducts } from "../data/product-store.js";
import { getContentRecommendations } from "../content-filtering/recommender.js";

async function main(): Promise<void> {
  console.log("=== Demo: Content Filtering (Exploitation) ===\n");

  seedDatabase();
  const model = clusterProducts(getAllProducts());

  console.log("Product clusters (K-means on title/description/tags):");
  for (const c of model.clusters) {
    const titles = c.productIds
      .map((id) => getProductById(id)?.title)
      .filter(Boolean)
      .slice(0, 4);
    console.log(`  Cluster ${c.clusterId}: ${titles.join(", ")}`);
  }

  const userId = "user-alice";
  const anchor = getOrdersByUser(userId)[0]?.productId;
  const anchorTitle = anchor ? getProductById(anchor)?.title : "?";

  console.log(`\nUser ${userId} viewing "${anchorTitle}" → similar products:\n`);
  const recs = anchor
    ? getContentRecommendations(userId, anchor, model)
    : [];
  for (const r of recs) {
    console.log(`  - ${r.title} (score ${r.score.toFixed(3)}) — ${r.reason}`);
  }

  console.log("\nPipeline: ProductDB → filter (rating≥3) → S3 → Spark/MLlib clustering → serve from cluster");

  closeDb();
}

main().catch(console.error);
