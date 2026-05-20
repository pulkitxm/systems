import { mkdirSync } from "fs";
import { PATHS } from "../config.js";
import { getDb, closeDb } from "../data/db.js";

async function main(): Promise<void> {
  console.log("Initializing Recommendation Engine...\n");

  mkdirSync(PATHS.dataDir, { recursive: true });
  mkdirSync(PATHS.dataLake, { recursive: true });

  getDb();
  console.log(`SQLite DB: ${PATHS.dbFile}`);
  console.log(`Data lake (S3 sim): ${PATHS.dataLake}`);
  console.log("\nTables: users, products, orders, browsing");
  console.log("Run: pnpm seed && pnpm demo:all");

  closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
