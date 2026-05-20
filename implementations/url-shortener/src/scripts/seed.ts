import { v4 as uuidv4 } from "uuid";
import { connectRedis, closeConnection } from "../connection.js";
import { resetRanges } from "../id-generation/range-store.js";
import { initRanges } from "../id-generation/range-store.js";
import { TICKET_SERVER } from "../config.js";
import { clearAllUrls } from "../storage/url-store.js";
import { shortenUrl, resolveShortUrl } from "../shortener.js";

const SAMPLE_URLS = [
  "https://example.com/blog/post-1",
  "https://github.com/user/repo",
  "https://example.com/blog/post-1",
  "https://news.site/article/12345",
];

async function main(): Promise<void> {
  console.log("Seeding URL Shortener...\n");

  await connectRedis();
  await clearAllUrls();
  await resetRanges();
  await initRanges(TICKET_SERVER.RANGE_COUNT, TICKET_SERVER.RANGE_SIZE);

  const user1 = uuidv4();
  const user2 = uuidv4();

  for (let i = 0; i < SAMPLE_URLS.length; i++) {
    const userId = i < 2 ? user1 : user2;
    const result = await shortenUrl(SAMPLE_URLS[i], userId);
    console.log(`  ${result.shortUrl} → ${SAMPLE_URLS[i].slice(0, 40)}...`);
  }

  console.log("\nResolve test:");
  const first = await shortenUrl("https://test.com/page", user1);
  const resolved = await resolveShortUrl(first.shortCode);
  console.log(`  ${first.shortUrl} resolves to ${resolved?.url}`);

  await closeConnection();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
