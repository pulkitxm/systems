import { redis } from "./connection.js";
import { FixedWindowLimiter } from "./fixed-window.js";
import { fireRequests, header, sleep } from "./utils.js";

async function main(): Promise<void> {
  header("FIXED WINDOW COUNTER DEMO");
  console.log("Limit: 5 requests per 5-second window");

  const limiter = new FixedWindowLimiter(redis, 5, 5);
  const user = "alice";
  await redis.flushdb();

  await fireRequests("burst-1", 7, () => limiter.check(user));

  console.log("\nWaiting 5s for window to reset...");
  await sleep(5200);

  await fireRequests("burst-2 (new window)", 7, () => limiter.check(user));

  header("EDGE BURST PROBLEM");
  console.log("Fire 5 requests at end of window, then 5 at start of next.");
  console.log("10 requests slip through in ~1 second, violating the spirit of 5/5s.\n");

  await redis.flushdb();
  const edgeLimiter = new FixedWindowLimiter(redis, 5, 5);
  const edgeUser = "bob";

  const now = Date.now();
  const windowMs = 5000;
  const msUntilBoundary = windowMs - (now % windowMs);
  console.log(`Sleeping ${msUntilBoundary - 500}ms to land at 500ms before boundary...`);
  await sleep(Math.max(0, msUntilBoundary - 500));

  await fireRequests("end of window", 5, () => edgeLimiter.check(edgeUser));
  await sleep(600);
  await fireRequests("start of next window", 5, () => edgeLimiter.check(edgeUser));
  console.log("\n→ 10 requests in ~1.1s even though the limit is 5 per 5s.");

  await redis.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
