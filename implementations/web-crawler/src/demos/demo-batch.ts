import { BATCH_UPLOAD_LAG_MS } from "../config.js";
import { runSpider } from "../crawler/spider.js";
import { SEED_URLS } from "../fixtures/seed-pages.js";
import { runUploadDaemon } from "../batch/upload-daemon.js";
import { closeUrlsDb, getUrlsDb } from "../urls-db/db.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Batch Upload Daemon — zip local → S3 → delete        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  getUrlsDb();
  await runSpider({ seedUrls: SEED_URLS, maxPages: 10 });

  const simulatedNow = Date.now() + BATCH_UPLOAD_LAG_MS + 60_000;
  const result = await runUploadDaemon(simulatedNow);

  console.log(`Daemon lag: ${BATCH_UPLOAD_LAG_MS / 60000} min behind wall clock\n`);

  if (result.uploaded.length === 0) {
    console.log("No partitions ready (run demo:crawl first or check staging paths).");
  } else {
    for (const batch of result.uploaded) {
      console.log(`  Uploaded: ${batch.s3Uri}`);
      console.log(`    Pages in zip: ${batch.manifest.length}`);
    }
    console.log(`\nDeleted local partitions: ${result.deletedPartitions.join(", ")}`);
  }

  console.log("\nBatching avoids per-page S3 PUTs (micro-writes are slow and costly).");

  closeUrlsDb();
}

main().catch(console.error);
