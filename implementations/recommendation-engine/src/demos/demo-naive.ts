import { closeDb } from "../data/db.js";
import { seedDatabase } from "../data/seed-data.js";
import { getPopularRecommendations } from "../naive/popular-items.js";
import { getPurchasedProductIds } from "../data/order-store.js";

function formatRecs(recs: ReturnType<typeof getPopularRecommendations>): string {
  return recs.map((r) => `  - ${r.title} (${r.reason})`).join("\n");
}

async function main(): Promise<void> {
  console.log("=== Demo: Naive Approach (Most Popular Items) ===\n");

  seedDatabase();

  console.log("Same recommendations for ALL users — no personalization:\n");

  for (const userId of ["user-alice", "user-dave"]) {
    const purchased = [...getPurchasedProductIds(userId)];
    console.log(`${userId} (already bought: ${purchased.length} items)`);
    console.log(formatRecs(getPopularRecommendations(userId, 5)));
    console.log("");
  }

  console.log("Problems:");
  console.log("  - Recommends items user already purchased");
  console.log("  - Same list for electronics fan and physics student");
  console.log("  - No budget/preference awareness → Hence, personalization needed");

  closeDb();
}

main().catch(console.error);
