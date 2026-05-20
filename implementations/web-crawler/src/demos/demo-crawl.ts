import { SEED_URLS } from "../fixtures/seed-pages.js";
import { runSpider } from "../crawler/spider.js";
import { countUrls } from "../urls-db/url-store.js";
import { closeUrlsDb, getUrlsDb } from "../urls-db/db.js";
import { upsertDomain } from "../urls-db/domain-store.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     BFS Spider — seed URLs → local staging → URLs DB      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  getUrlsDb();
  upsertDomain({
    domain: "news.example.com",
    cooldownMs: 60 * 60 * 1000,
    status: "REPUTED",
    rank: 90,
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

  console.log(`Seed URLs: ${SEED_URLS.join(", ")}\n`);

  const stats = await runSpider({ seedUrls: SEED_URLS, maxPages: 20, maxDepth: 4 });

  console.log("Crawl stats:");
  console.log(`  Fetched:           ${stats.fetched}`);
  console.log(`  Staged (local):    ${stats.staged}`);
  console.log(`  Links discovered:  ${stats.linksDiscovered}`);
  console.log(`  Skipped (cooldown):${stats.skippedCooldown}`);
  console.log(`  Skipped (unknown): ${stats.skippedUnknown}`);
  console.log(`  URLs in DB:        ${countUrls()}`);
  console.log("\nPages written to time-partitioned local folders (not S3 per page).");

  closeUrlsDb();
}

main().catch(console.error);
