import { mkdir } from "fs/promises";
import { PATHS } from "../config.js";
import {
  estimateInvertedIndexSize,
  formatCapacityReport,
} from "../capacity/inverted-index-estimate.js";
import { getUrlsDb, closeUrlsDb } from "../urls-db/db.js";
import { getInvertedIndexDb, closeInvertedIndexDb } from "../storage/inverted-index.js";

async function main(): Promise<void> {
  console.log("Initializing Web Crawler...\n");

  await mkdir(PATHS.dataDir, { recursive: true });
  await mkdir(PATHS.localStaging, { recursive: true });
  await mkdir(PATHS.s3Root, { recursive: true });
  await mkdir(PATHS.archiveDir, { recursive: true });

  getUrlsDb();
  console.log("URLs DB collections:");
  console.log("  - urls (partition key: domain)");
  console.log("  - domains (cooldown, rank, status)\n");

  getInvertedIndexDb();
  console.log("Inverted index store (simulates DynamoDB KV):");
  console.log("  - inverted_index (word → doc_ids JSON)");
  console.log("  - processed_batches (Spark checkpoint)\n");

  console.log(formatCapacityReport(estimateInvertedIndexSize()));
  console.log("\nLocal staging:", PATHS.localStaging);
  console.log("S3 root:      ", PATHS.s3Root);

  closeUrlsDb();
  closeInvertedIndexDb();
  console.log("\nInit complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
