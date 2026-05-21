import { redis } from "./connection.js";
import { LeakyBucketLimiter } from "./leaky-bucket.js";
import { fireRequests, header, sleep } from "./utils.js";

async function main(): Promise<void> {
  header("LEAKY BUCKET DEMO");
  console.log("Capacity: 5, Leak rate: 2 req/sec");
  console.log("Requests add water; water leaks continuously.");
  console.log("Rejects when adding a request would overflow.\n");

  await redis.flushdb();
  const limiter = new LeakyBucketLimiter(redis, 5, 2);
  const user = "alice";

  await fireRequests("burst (fills bucket)", 8, () => limiter.check(user));

  console.log("\nWaiting 1s → bucket leaks ~2 units...");
  await sleep(1000);
  await fireRequests("try 3 (2 should fit)", 3, () => limiter.check(user));

  console.log("\nWaiting 3s → bucket fully drains...");
  await sleep(3000);
  await fireRequests("fresh burst (5 should fit)", 7, () => limiter.check(user));

  header("STEADY RATE BEHAVIOR");
  console.log("At leak rate (500ms per request), all requests pass forever.\n");

  await redis.flushdb();
  const steady = new LeakyBucketLimiter(redis, 5, 2);
  await fireRequests("steady 500ms cadence", 10, () => steady.check("bob"), 500);

  await redis.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
