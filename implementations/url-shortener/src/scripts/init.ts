import { CAPACITY, TICKET_SERVER } from "../config.js";
import { connectRedis, redis } from "../connection.js";
import { initRanges } from "../id-generation/range-store.js";

async function main(): Promise<void> {
  console.log("Initializing URL Shortener...\n");

  try {
    await connectRedis();
    const pong = await redis.ping();
    console.log(`Redis: ${pong}`);
  } catch (e) {
    console.error("Redis not available. Run: docker compose up -d");
    throw e;
  }

  const ranges = await initRanges(
    TICKET_SERVER.RANGE_COUNT,
    TICKET_SERVER.RANGE_SIZE
  );

  console.log(`Ticket server: ${ranges.length} ranges initialized`);
  for (const r of ranges) {
    console.log(`  Range ${r.id}: ${r.min} – ${r.max} (current: ${r.current})`);
  }

  console.log(`\nCapacity estimate: ${CAPACITY.URLS_PER_MONTH / 1e6}M URLs/month`);
  console.log(
    `  ${CAPACITY.SHORT_CODE_BYTES} + ${CAPACITY.URL_BYTES} bytes/record → ~${CAPACITY.GB_PER_MONTH} GB/month`
  );
  console.log("  Storage is not the concern — sharding handles load.\n");

  console.log("Init complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
