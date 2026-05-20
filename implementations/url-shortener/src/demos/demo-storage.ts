import { v4 as uuidv4 } from "uuid";
import { CAPACITY } from "../config.js";
import { connectRedis, closeConnection } from "../connection.js";
import { initRanges, resetRanges } from "../id-generation/range-store.js";
import { TICKET_SERVER } from "../config.js";
import { clearAllUrls, getShardForShortCode } from "../storage/url-store.js";
import { shortenUrl, resolveShortUrl } from "../shortener.js";

async function main(): Promise<void> {
  console.log("=== Demo: KV Storage & Sharding by short_code ===\n");

  await connectRedis();
  await clearAllUrls();
  await resetRanges();
  await initRanges(TICKET_SERVER.RANGE_COUNT, TICKET_SERVER.RANGE_SIZE);

  console.log("Capacity (from slides):");
  console.log(`  100M URLs/month × ${CAPACITY.BYTES_PER_RECORD} bytes ≈ ${CAPACITY.GB_PER_MONTH} GB/month`);
  console.log("  → Storage is NOT the concern. Sharding handles LOAD.\n");

  const userId = uuidv4();
  const urls = [
    "https://docs.example.com/guide",
    "https://shop.example.com/product/42",
    "https://blog.example.com/2024/post",
  ];

  console.log("Shorten URLs:");
  const results = [];
  for (const url of urls) {
    const r = await shortenUrl(url, userId);
    const shard = getShardForShortCode(r.shortCode);
    results.push(r);
    console.log(`  ${r.shortUrl}`);
    console.log(`    → ${url}`);
    console.log(`    shard (short_code hash % 4): ${shard}`);
  }

  console.log("\nResolve (KV lookup by short_code):");
  for (const r of results) {
    const resolved = await resolveShortUrl(r.shortCode);
    console.log(`  ${r.shortCode} → ${resolved?.url ?? "NOT FOUND"}`);
  }

  console.log("\nNote: short_code is NOT derived from the original URL.");
  console.log("  Same URL shortened twice → different short_codes (different IDs).");

  const sameUrl = "https://example.com/shared";
  const a = await shortenUrl(sameUrl, uuidv4());
  const b = await shortenUrl(sameUrl, uuidv4());
  console.log(`\n  User 1: ${a.shortUrl}`);
  console.log(`  User 2: ${b.shortUrl}`);

  await closeConnection();
}

main().catch(console.error);
