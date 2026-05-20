import { v4 as uuidv4 } from "uuid";
import { CAPACITY, TICKET_SERVER } from "../config.js";
import { connectRedis, closeConnection } from "../connection.js";
import { compareApproaches, formatComparison } from "../encoding/approaches.js";
import { encodeWalkthrough } from "../encoding/base62.js";
import { initRanges, resetRanges } from "../id-generation/range-store.js";
import { getNextIds } from "../id-generation/ticket-server.js";
import { encode } from "../encoding/base62.js";
import { clearAllUrls, getShardForShortCode } from "../storage/url-store.js";
import { shortenUrl, resolveShortUrl } from "../shortener.js";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        URL Shortener — Full System Design Demo           ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  await connectRedis();
  await clearAllUrls();
  await resetRanges();
  await initRanges(TICKET_SERVER.RANGE_COUNT, TICKET_SERVER.RANGE_SIZE);

  console.log("1. Three approaches (why custom encoding wins)\n");
  console.log(formatComparison(compareApproaches("https://example.com", 1729)));

  console.log("2. Encoding walkthrough (ID 79)\n");
  const w = encodeWalkthrough(79);
  console.log(`   ${w.id} → binary ${w.binary} → padded ${w.paddedBinary}`);
  console.log(`   Sequential: ${w.sequentialCode} | Shuffled: ${w.shuffledCode}\n`);

  console.log("3. Ticket server — pseudo-random IDs\n");
  const ids = await getNextIds(8);
  console.log(`   IDs: ${ids.join(", ")}`);
  console.log(`   Codes: ${ids.map((id) => encode(id)).join(", ")}\n`);

  console.log("4. Shorten & resolve (KV store, sharded by short_code)\n");
  const userId = uuidv4();
  const longUrl = "https://arpitbhayani.me/system-design";
  const result = await shortenUrl(longUrl, userId);
  const shard = getShardForShortCode(result.shortCode);
  const resolved = await resolveShortUrl(result.shortCode);

  console.log(`   Original:  ${longUrl}`);
  console.log(`   Short:     ${result.shortUrl}`);
  console.log(`   Shard:     ${shard}`);
  console.log(`   Resolved:  ${resolved?.url}\n`);

  console.log("5. Capacity & sharding rationale\n");
  console.log(`   ~${CAPACITY.GB_PER_MONTH} GB/month for 100M URLs — storage is fine`);
  console.log("   Shard for load (read/write QPS), not disk size\n");

  await closeConnection();
}

main().catch(console.error);
