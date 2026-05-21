import Redis from "ioredis";
import { redis } from "./connection.js";
import { FixedWindowLimiter } from "./fixed-window.js";
import { header, sleep } from "./utils.js";

async function naiveCheck(
  client: Redis,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const current = Number((await client.get(key)) ?? "0");
  if (current >= limit) return false;

  await sleep(5);

  await client.incr(key);
  await client.expire(key, windowSeconds);
  return true;
}

async function main(): Promise<void> {
  header("RACE CONDITION DEMO");
  console.log("Limit: 5 per 10s. Fire 20 concurrent requests.");

  await redis.flushdb();

  console.log("\n[naive] read → check → incr (NOT atomic):");
  const naiveKey = "naive:alice";
  const naive = await Promise.all(
    Array.from({ length: 20 }, () => naiveCheck(redis, naiveKey, 5, 10))
  );
  const naiveAllowed = naive.filter(Boolean).length;
  console.log(`  allowed=${naiveAllowed} (expected 5)`);
  if (naiveAllowed > 5) {
    console.log(`  → RACE CONDITION: ${naiveAllowed - 5} requests leaked through`);
  }

  await redis.flushdb();

  console.log("\n[lua] atomic INCR + EXPIRE inside a single script:");
  const limiter = new FixedWindowLimiter(redis, 5, 10, "rl:race");
  const atomic = await Promise.all(
    Array.from({ length: 20 }, () => limiter.check("alice"))
  );
  const atomicAllowed = atomic.filter((r) => r.allowed).length;
  console.log(`  allowed=${atomicAllowed} (expected 5)`);
  if (atomicAllowed === 5) {
    console.log("  → Lua script holds the rate limit under concurrency");
  }

  await redis.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
