import { redis } from "./connection.js";
import { SlidingWindowCounterLimiter } from "./sliding-window-counter.js";
import { fireRequests, header, sleep } from "./utils.js";

async function main(): Promise<void> {
  header("SLIDING WINDOW COUNTER DEMO");
  console.log("Limit: 10 requests per 5-second window");
  console.log("Approximates sliding window using weighted previous+current counters.");
  console.log("Memory: 2 integers per user (vs full log of timestamps).\n");

  await redis.flushdb();
  const limiter = new SlidingWindowCounterLimiter(redis, 10, 5000);
  const user = "alice";

  await fireRequests("fill up window", 10, () => limiter.check(user));
  await fireRequests("try 3 more (should reject)", 3, () => limiter.check(user));

  console.log("\nWaiting 2.5s (half the window elapses)...");
  await sleep(2500);
  await fireRequests("after half window", 10, () => limiter.check(user), 100);

  header("SMOOTHING EFFECT");
  console.log("Near the boundary, previous-window weight decays linearly.");
  console.log("A burst at the edge is partially counted against the new window.\n");

  await redis.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
