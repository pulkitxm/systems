import { closeDb } from "../data/db.js";
import { seedDatabase } from "../data/seed-data.js";
import { compareApproaches } from "../service/recommendation-service.js";
import { similarityWalkthrough } from "../similarity/cosine.js";

function printRecs(label: string, recs: Array<{ title: string; source: string; reason?: string }>): void {
  console.log(`\n${label}:`);
  for (const r of recs) {
    console.log(`  - ${r.title} [${r.source}] ${r.reason ?? ""}`);
  }
}

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        Recommendation Engine — Full Demo                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  seedDatabase();

  console.log(similarityWalkthrough());

  const userId = "user-alice";
  const all = compareApproaches(userId);

  console.log(`\n--- Recommendations for ${userId} ---`);
  printRecs("Naive (popular)", all.naive);
  printRecs("Content filtering (exploitation)", all.content);
  printRecs("Collaborative filtering (exploration)", all.collaborative);
  printRecs("Blended feed (60% exploit + 40% explore)", all.blended);

  console.log("\n--- Key insight ---");
  console.log("Good feeds blend exploitation + exploration — not one or the other.");

  closeDb();
}

main().catch(console.error);
