import { closeDb } from "../data/db.js";
import { seedDatabase } from "../data/seed-data.js";
import { buildEngine } from "../service/recommendation-service.js";

async function main(): Promise<void> {
  console.log("Seeding recommendation engine data...\n");

  const { users, products } = seedDatabase();
  console.log(`  Users: ${users.length}`);
  console.log(`  Products: ${products.size}`);

  const eng = buildEngine();
  console.log(`  Product clusters: ${eng.productModel.clusters.length}`);
  for (const c of eng.productModel.clusters) {
    console.log(`    Cluster ${c.clusterId}: ${c.productIds.length} products [${c.keywords.slice(0, 4).join(", ")}]`);
  }
  console.log(`  User clusters: ${eng.userModel.clusters.length}`);
  for (const c of eng.userModel.clusters) {
    console.log(`    Cohort ${c.clusterId}: ${c.userIds.join(", ")}`);
  }

  closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
