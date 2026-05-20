import { upsertDomain } from "../urls-db/domain-store.js";
import { closeUrlsDb, getUrlsDb } from "../urls-db/db.js";

async function main(): Promise<void> {
  getUrlsDb();

  console.log("Seeding domain configurations...\n");

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
    displayName: "Example Wiki",
  });

  upsertDomain({
    domain: "blog.example.com",
    cooldownMs: 24 * 60 * 60 * 1000,
    status: "NORMAL",
    rank: 40,
    displayName: "Example Blog",
  });

  console.log("  news.example.com  → 1h cooldown (frequently updated)");
  console.log("  wiki.example.com  → 7d cooldown");
  console.log("  blog.example.com  → 1d cooldown");

  closeUrlsDb();
  console.log("\nSeed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
