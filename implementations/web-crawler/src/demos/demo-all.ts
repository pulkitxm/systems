import { rm, mkdir } from "fs/promises";
import { PATHS, BATCH_UPLOAD_LAG_MS } from "../config.js";
import {
  estimateInvertedIndexSize,
  formatCapacityReport,
} from "../capacity/inverted-index-estimate.js";
import { SEED_URLS } from "../fixtures/seed-pages.js";
import { runSpider } from "../crawler/spider.js";
import { runUploadDaemon } from "../batch/upload-daemon.js";
import { runBatchIndexer } from "../indexer/batch-processor.js";
import { searchQuery } from "../search/query.js";
import { upsertDomain } from "../urls-db/domain-store.js";
import { countUrls } from "../urls-db/url-store.js";
import { getInvertedIndexStats } from "../storage/inverted-index.js";
import { closeUrlsDb, getUrlsDb } from "../urls-db/db.js";
import { closeInvertedIndexDb, getInvertedIndexDb } from "../storage/inverted-index.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Web Crawler — Full Pipeline (work backwards)          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  await rm(PATHS.dataDir, { recursive: true, force: true });
  await mkdir(PATHS.dataDir, { recursive: true });
  await mkdir(PATHS.localStaging, { recursive: true });
  await mkdir(PATHS.s3Root, { recursive: true });

  console.log("1. Capacity — why DynamoDB, not one node\n");
  console.log(formatCapacityReport(estimateInvertedIndexSize()) + "\n");

  getUrlsDb();
  upsertDomain({
    domain: "news.example.com",
    cooldownMs: 60 * 60 * 1000,
    status: "REPUTED",
    rank: 90,
    displayName: "Example News",
  });
  upsertDomain({
    domain: "wiki.example.com",
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
    status: "REPUTED",
    rank: 95,
  });
  upsertDomain({
    domain: "blog.example.com",
    cooldownMs: 24 * 60 * 60 * 1000,
    status: "NORMAL",
    rank: 40,
  });

  console.log("2. BFS spider → local staging + URLs DB\n");
  const crawl = await runSpider({ seedUrls: SEED_URLS, maxPages: 15 });
  console.log(`   Fetched ${crawl.fetched} pages, ${countUrls()} URL records\n`);

  console.log("3. Upload daemon → zip batches → S3\n");
  const upload = await runUploadDaemon(Date.now() + BATCH_UPLOAD_LAG_MS + 120_000);
  console.log(`   Uploaded ${upload.uploaded.length} zip batch(es) to simulated S3\n`);

  getInvertedIndexDb();
  console.log("4. Spark-style indexer → inverted index\n");
  const index = await runBatchIndexer();
  const stats = getInvertedIndexStats();
  console.log(`   Indexed ${index.pagesIndexed} pages, ${stats.wordCount} unique words\n`);

  console.log("5. Search lookup (relevance out of scope)\n");
  for (const q of ["apple", "distributed"]) {
    const hits = searchQuery(q);
    console.log(`   "${q}" → ${hits.map((h) => `${h.word}:${h.docIds.length}`).join(", ")}`);
  }

  console.log("\n6. Design recap");
  console.log("   • Work backwards: inverted index → extraction → S3 batches → crawler");
  console.log("   • Batch writes to S3; daemon runs ~5 min behind crawl clock");
  console.log("   • URLs DB: domain partition, last 5 crawls, per-domain cooldown");
  console.log("   • Champion lists + compression shrink ~320 TB index at scale");

  closeUrlsDb();
  closeInvertedIndexDb();
}

main().catch(console.error);
