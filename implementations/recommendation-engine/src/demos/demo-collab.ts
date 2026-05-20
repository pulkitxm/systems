import { closeDb } from "../data/db.js";
import { seedDatabase } from "../data/seed-data.js";
import { clusterUsers } from "../collaborative-filtering/user-clusterer.js";
import { graphQueryDemo } from "../collaborative-filtering/graph-store.js";
import { getCollaborativeRecommendations } from "../collaborative-filtering/recommender.js";

async function main(): Promise<void> {
  console.log("=== Demo: Collaborative Filtering (Exploration) ===\n");

  seedDatabase();
  const userModel = clusterUsers();

  console.log("User cohorts (clustered by order/browsing patterns):");
  for (const c of userModel.clusters) {
    console.log(`  Cohort ${c.clusterId}: ${c.userIds.join(", ")}`);
  }

  const userId = "user-bob";
  console.log(`\n${graphQueryDemo(userId, userModel)}`);

  console.log("\nRecommendations (exploration — new items from similar users):");
  for (const r of getCollaborativeRecommendations(userId, userModel)) {
    console.log(`  - ${r.title} — ${r.reason}`);
  }

  console.log("\nGraph DB (Neo4j) excels at: users similar to me → what did they buy that I didn't?");

  closeDb();
}

main().catch(console.error);
